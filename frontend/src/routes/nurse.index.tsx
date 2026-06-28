import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, ClipboardList, Sparkles, Loader2 } from "lucide-react";
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

    // WebSocket real-time listener for live updates (Agent 12 Integration)
    const ws = new WebSocket(getWsUrl("/ws/admin"));
    
    ws.onopen = () => {
      console.log("[WebSocket] Connected to Nurse Dashboard feed.");
    };

    ws.onmessage = (event) => {
      console.log("[WebSocket] Message received on Nurse Dashboard:", event.data);
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "new_alert" || payload.type === "new_alert") {
          toast.error(`ALERT BREACH: ${payload.message}`, {
            description: `Bed ${payload.bed_number} · NEWS2: ${payload.news2_score}`,
            duration: 6000
          });
        }
      } catch (e) {
        // Fallback for simple message
      }
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
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading ward patient logs...</p>
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
          className="mt-4 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold"
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

  // Sort patients so critical/high risk are at the top
  const sortedHighRiskPatients = [...patients]
    .filter(p => p.latest_risk_level === "RED" || p.latest_risk_level === "ORANGE" || p.latest_risk_level === "YELLOW")
    .sort((a, b) => {
      const riskWeight: Record<string, number> = { RED: 3, ORANGE: 2, YELLOW: 1 };
      const weightA = riskWeight[a.latest_risk_level || ""] || 0;
      const weightB = riskWeight[b.latest_risk_level || ""] || 0;
      return weightB - weightA;
    });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-gradient-to-r from-white to-primary-soft/50 p-5 shadow-card animate-in fade-in duration-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{greeting}</div>
            <h2 className="font-display text-2xl text-foreground font-semibold">{name}</h2>
            <div className="mt-1 text-sm text-muted-foreground">{ward} · {shift} shift</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone="primary">Shift in progress</StatusPill>
            <Link to="/nurse/patients" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant">View patients</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="My patients" value={patients.length} tone="primary" />
        <Stat label="Pending vitals" value={pendingVitals} tone={pendingVitals > 0 ? "warning" : "success"} />
        <Stat label="Active Alerts" value={activeAlerts} tone={activeAlerts > 0 ? "critical" : "success"} />
        <Stat label="Critical Risk Patients" value={critical} tone={critical > 0 ? "critical" : "primary"} />
        <Stat label="Shift progress" value="62%" hint="of 12 hr shift" tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <SectionHeader title="Today's Tasks"
            action={<Link to="/nurse/tasks" className="text-sm font-medium text-primary hover:underline">View all</Link>} />
          <ul className="space-y-3">
            {[
              { t: "Enter morning shift patient vitals", s: pendingVitals > 0 ? `${pendingVitals} pending` : "Done", icon: Activity, tone: pendingVitals > 0 ? "warning" as const : "success" as const },
              { t: "Routine ICU Bay 3 review round", s: "Pending", icon: ClipboardList, tone: "info" as const },
              { t: "Prepare shift handover SBAR reports", s: "Pending", icon: Sparkles, tone: "primary" as const },
              { t: `Review active clinical alerts (${activeAlerts})`, s: activeAlerts > 0 ? "Action required" : "Clear", icon: AlertTriangle, tone: activeAlerts > 0 ? "critical" as const : "success" as const },
              { t: "Roster log & hand hygiene audit check", s: "Done", icon: CheckCircle2, tone: "success" as const },
            ].map((it, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-border bg-white p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary"><it.icon className="h-4 w-4" /></span>
                  <div className="text-sm font-medium text-foreground">{it.t}</div>
                </div>
                <StatusPill tone={it.tone}>{it.s}</StatusPill>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeader title="High-priority patients" />
          <ul className="space-y-3">
            {sortedHighRiskPatients.slice(0, 5).map(p => (
              <li key={p.id}>
                <Link to={`/nurse/patient/${p.id}` as never} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 hover:border-primary/30">
                  <div>
                    <div className="text-sm font-medium text-foreground">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">Bed {p.bed_number} · {p.primary_diagnosis}</div>
                  </div>
                  <StatusPill tone={riskTone(p.latest_risk_level as any || "Low")}>{p.latest_risk_level || "Low"}</StatusPill>
                </Link>
              </li>
            ))}
            {sortedHighRiskPatients.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No high or moderate risk patients currently assigned.
              </div>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}