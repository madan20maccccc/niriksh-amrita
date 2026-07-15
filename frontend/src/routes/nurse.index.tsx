import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  Activity, AlertTriangle, CheckCircle2, Sparkles, Loader2, 
  ArrowRight, Heart, BellRing, ClipboardList, ShieldAlert
} from "lucide-react";
import { Card, SectionHeader, Stat } from "@/components/ui/section";
import { StatusPill, riskTone } from "@/components/ui/status-pill";
import { getSession } from "@/lib/auth";
import { getPatients, getWsUrl } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/nurse/")({ component: NurseHome });

function NurseHome() {
  const [name, setName] = useState("Nurse");
  const [ward, setWard] = useState("Ward");
  const [shift, setShift] = useState("Morning");
  
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatientsData = async () => {
    try {
      const data = await getPatients();
      setPatients(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load patient records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const s = getSession();
    if (s) {
      setName(s.name);
      setWard(s.ward ?? "General Ward");
      setShift(s.shift ?? "Morning");
    }

    loadPatientsData();

    // WebSocket real-time alerts
    const ws = new WebSocket(getWsUrl("/ws/admin"));
    
    ws.onopen = () => {
      console.log("[WebSocket] Connected to Nurse Dashboard feed.");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "new_alert" || payload.type === "new_alert") {
          toast.error(`ALERT BREACH: ${payload.message}`, {
            description: `Bed ${payload.bed_number} · NEWS2: ${payload.news2_score}`,
            duration: 8000
          });
        }
      } catch (e) {}
      loadPatientsData();
    };

    ws.onclose = () => {
      console.log("[WebSocket] Disconnected from Nurse Dashboard feed.");
    };

    return () => {
      ws.close();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 bg-slate-50/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Syncing ward logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20 shadow-card">
        <h3 className="font-display text-xl font-bold">Surveillance Offline</h3>
        <p className="mt-2 text-sm">{error}</p>
        <button 
          onClick={() => { setLoading(true); loadPatientsData(); }}
          className="mt-4 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold hover:bg-destructive/90 transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const critical = patients.filter(p => p.latest_risk_level === "RED").length;
  const highRisk = patients.filter(p => p.latest_risk_level === "ORANGE").length;
  const activeAlerts = patients.reduce((sum, p) => sum + (p.active_alerts || 0), 0);
  const pendingVitals = patients.filter(p => !p.last_vitals_at).length;
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  // Sorting: red first, then orange, then yellow
  const sortedPatients = [...patients].sort((a, b) => {
    const riskWeight: Record<string, number> = { RED: 3, ORANGE: 2, YELLOW: 1, GREEN: 0 };
    return (riskWeight[b.latest_risk_level || "GREEN"] || 0) - (riskWeight[a.latest_risk_level || "GREEN"] || 0);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Ward Status Greeting Banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-white to-primary-soft/30 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary shadow-sm">
              <Heart className="h-5.5 w-5.5 animate-pulse" />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{greeting}</div>
              <h2 className="font-display text-xl font-bold text-slate-800 leading-tight">{name}</h2>
              <div className="mt-0.5 text-xs text-muted-foreground font-semibold">{ward} · {shift} Shift rounds</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone="primary" className="font-bold">Surveillance Active</StatusPill>
            <Link to="/nurse/patients" className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-elegant hover:opacity-95 transition">
              Patients Queue
            </Link>
          </div>
        </div>
      </div>

      {/* Ward Telemetry Counters */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Total Beds" value={patients.length} tone="primary" />
        <Stat label="Pending Rounds" value={pendingVitals} tone={pendingVitals > 0 ? "warning" : "success"} />
        <Stat label="Active Warnings" value={activeAlerts} tone={activeAlerts > 0 ? "critical" : "success"} />
        <Stat label="Red Patients" value={critical} tone={critical > 0 ? "critical" : "primary"} />
        <Stat label="Ward Status" value={critical > 0 ? "HIGH ALERT" : highRisk > 0 ? "STRAINED" : "NOMINAL"} tone={critical > 0 ? "critical" : highRisk > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        
        {/* Ward patient logs queue */}
        <Card className="p-5 bg-white/70 backdrop-blur-md">
          <SectionHeader title="Shift Ward Risk Queue" hint="Dynamic risk ranking based on vital logs" />
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pr-2">Bed</th>
                  <th className="pb-3 pr-2">Patient</th>
                  <th className="pb-3 pr-2">NEWS2 Risk</th>
                  <th className="pb-3 pr-2">Main Clinical Issue</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sortedPatients.map(p => {
                  const risk = p.latest_risk_level || "GREEN";
                  
                  // Extract issue string
                  let issueText = "Vitals Stable";
                  if (risk === "RED" || risk === "ORANGE") {
                    issueText = p.latest_spo2 < 92 ? "Acute Oxygen Desaturation" : "Tachycardia & Hypertensive Crisis";
                  } else if (risk === "YELLOW") {
                    issueText = "Mild tachycardia / watch vitals";
                  }

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 pr-2 font-bold text-slate-800 font-mono">Bed {p.bed_number}</td>
                      <td className="py-3 pr-2">
                        <Link to={`/nurse/patient/${p.id}` as never} className="hover:underline font-bold text-slate-800">
                          {p.full_name}
                        </Link>
                        <div className="text-[10px] text-muted-foreground font-semibold">{p.age}y · {p.gender}</div>
                      </td>
                      <td className="py-3 pr-2">
                        <StatusPill tone={riskTone(risk as any)} className="font-bold">{risk}</StatusPill>
                      </td>
                      <td className="py-3 pr-2 font-medium text-slate-700 max-w-[150px] truncate" title={issueText}>
                        {issueText}
                      </td>
                      <td className="py-3 text-right space-x-1 whitespace-nowrap">
                        <Link to={`/nurse/vitals/${p.id}` as never} className="inline-block rounded-lg bg-primary-soft text-primary px-2.5 py-1.5 font-bold hover:bg-primary hover:text-white transition">
                          Add Vitals
                        </Link>
                        <Link to={`/nurse/patient/${p.id}` as never} className="inline-block rounded-lg border border-border bg-white px-2.5 py-1.5 font-bold text-slate-700 hover:bg-muted transition">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Tasks Checklist */}
        <Card className="p-5 bg-white/70 backdrop-blur-md">
          <SectionHeader title="Rounding Duties Checklist" action={<Link to="/nurse/tasks" className="text-xs font-bold text-primary hover:underline">View All Tasks</Link>} />
          <ul className="space-y-3 mt-4">
            {[
              { t: "Complete shift round vitals log", s: pendingVitals > 0 ? `${pendingVitals} remaining` : "Finished", tone: pendingVitals > 0 ? "warning" as const : "success" as const },
              { t: "Acknowledge critical escalation logs", s: activeAlerts > 0 ? "Urgent review" : "Clear", tone: activeAlerts > 0 ? "critical" as const : "success" as const },
              { t: "Review SBAR handover notes", s: "Pending", tone: "primary" as const },
              { t: "Conduct hygiene / roster logs check", s: "Finished", tone: "success" as const }
            ].map((it, idx) => (
              <li key={idx} className="flex items-center justify-between rounded-xl border border-border bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary shrink-0">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <div className="text-xs font-bold text-slate-800 leading-tight">{it.t}</div>
                </div>
                <StatusPill tone={it.tone} className="font-bold shrink-0">{it.s}</StatusPill>
              </li>
            ))}
          </ul>
        </Card>

      </div>
    </div>
  );
}