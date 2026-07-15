import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, AlertTriangle, Hospital, Sparkles, Users, Loader2,
  ShieldAlert, Clock, BedDouble, TrendingUp, Zap, RefreshCw,
  ChevronRight, Wifi,
} from "lucide-react";
import {
  AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { StatusPill, riskTone } from "@/components/ui/status-pill";
import { getAnalyticsSummary, getAlerts, getWsUrl, getPatients } from "@/lib/api";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

// Bed risk colors — refined sapphire system
const BED_COLORS: Record<string, { bg: string; text: string; ring: string; pulse: boolean }> = {
  RED:    { bg: "bg-red-500",     text: "text-white", ring: "ring-2 ring-red-300",    pulse: true  },
  ORANGE: { bg: "bg-orange-400",  text: "text-white", ring: "ring-2 ring-orange-200", pulse: false },
  YELLOW: { bg: "bg-amber-400",   text: "text-white", ring: "",                       pulse: false },
  GREEN:  { bg: "bg-emerald-500", text: "text-white", ring: "",                       pulse: false },
  Empty:  { bg: "bg-slate-100",   text: "text-slate-400", ring: "border border-dashed border-slate-300", pulse: false },
};

function StatCard({ label, value, sub, icon, tone }: { label: string; value: React.ReactNode; sub?: string; icon: React.ReactNode; tone: "blue" | "red" | "green" | "amber" | "teal" }) {
  const toneMap = {
    blue:  { card: "from-blue-50 to-indigo-50 border-blue-100",  icon: "bg-blue-100 text-blue-600",  val: "text-blue-700" },
    red:   { card: "from-red-50 to-orange-50 border-red-100",    icon: "bg-red-100 text-red-600",    val: "text-red-700" },
    green: { card: "from-emerald-50 to-teal-50 border-green-100",icon: "bg-emerald-100 text-emerald-600", val: "text-emerald-700" },
    amber: { card: "from-amber-50 to-yellow-50 border-amber-100",icon: "bg-amber-100 text-amber-600",val: "text-amber-700" },
    teal:  { card: "from-teal-50 to-cyan-50 border-teal-100",    icon: "bg-teal-100 text-teal-600",  val: "text-teal-700" },
  }[tone];

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${toneMap.card} p-4`} style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${toneMap.icon}`}>{icon}</div>
        <div className="text-right">
          <div className={`text-2xl font-bold leading-none ${toneMap.val}`} style={{ fontFamily: "var(--font-display)" }}>{value}</div>
          {sub && <div className="text-[10px] text-slate-400 font-medium mt-1">{sub}</div>}
        </div>
      </div>
      <div className="mt-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function AdminDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const loadDashboardData = async () => {
    try {
      const [summary, alertsData, patientsData] = await Promise.all([
        getAnalyticsSummary(),
        getAlerts(undefined, undefined, "active"),
        getPatients(),
      ]);
      setAnalytics(summary);
      setRecentAlerts(alertsData);
      setPatients(patientsData);
      setLastSync(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load hospital operations data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const ws = new WebSocket(getWsUrl("/ws/admin"));
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "new_alert" || payload.type === "new_alert") {
          toast.error(`CRITICAL: ${payload.message}`, {
            description: `Bed ${payload.bed_number} · NEWS2: ${payload.news2_score}`,
            duration: 8000,
          });
        }
      } catch {}
      loadDashboardData();
    };
    return () => ws.close();
  }, []);

  if (loading) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: "oklch(0.45 0.22 258)" }} />
        <div className="relative h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "oklch(0.94 0.04 255 / 0.5)" }}>
          <Hospital className="h-6 w-6" style={{ color: "oklch(0.45 0.22 258)" }} />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500">Initializing Command Centre...</p>
    </div>
  );

  if (error || !analytics) return (
    <div className="mx-auto mt-12 max-w-md rounded-3xl bg-red-50 border border-red-200 p-7 text-center space-y-4">
      <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
        <ShieldAlert className="h-6 w-6 text-red-600" />
      </div>
      <h3 className="font-bold text-slate-900 text-base" style={{ fontFamily: "var(--font-display)" }}>Operations Hub Offline</h3>
      <p className="text-sm text-red-700">{error || "Could not retrieve hospital statistics."}</p>
      <button onClick={() => { setLoading(true); loadDashboardData(); }}
        className="px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all hover:scale-105"
        style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))" }}>
        <RefreshCw className="h-3.5 w-3.5 inline mr-1.5" /> Retry Connection
      </button>
    </div>
  );

  const occupied = analytics.ward_stats.reduce((s: number, w: any) => s + w.total_patients, 0);
  const totalBeds = analytics.ward_stats.length * 20;
  const critical = patients.filter(p => p.latest_risk_level === "RED").length;
  const highRisk = patients.filter(p => p.latest_risk_level === "ORANGE").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Command Centre Banner */}
      <div className="rounded-3xl overflow-hidden relative" style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, oklch(0.215 0.05 258), oklch(0.28 0.07 268))" }} />
        <div className="absolute inset-0 grid-dots opacity-30" />
        <div className="relative px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
              <Hospital className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-[11px] text-blue-200 uppercase tracking-widest font-bold">Amrita Hospital · Command Centre</div>
              <h2 className="text-xl font-bold text-white leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                Clinical Surveillance Dashboard
              </h2>
              <div className="text-xs text-blue-300 font-medium mt-0.5">
                {analytics.ward_stats.length} Active Wards · Real-Time Escalation Pipeline
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${wsConnected ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" : "bg-red-500/20 border-red-400/40 text-red-300"}`}>
              <Wifi className="h-3.5 w-3.5" />
              {wsConnected ? "Live Feed Active" : "Reconnecting..."}
            </div>
            <div className="text-right text-[11px] text-blue-300 font-semibold">
              <div>Last sync</div>
              <div className="text-white font-bold">{lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <button onClick={() => { setLoading(true); loadDashboardData(); }}
              className="h-9 w-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center hover:bg-white/25 transition">
              <RefreshCw className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Patients"  value={analytics.total_patients}    icon={<Users className="h-4.5 w-4.5" />}      tone="blue"  />
        <StatCard label="Active Warnings" value={analytics.total_active_alerts} sub={analytics.total_active_alerts > 0 ? "Require review" : "All clear"} icon={<AlertTriangle className="h-4.5 w-4.5" />} tone={analytics.total_active_alerts > 0 ? "red" : "green"} />
        <StatCard label="Critical (RED)"  value={critical}  sub={critical > 0 ? "Immediate action" : "None"} icon={<ShieldAlert className="h-4.5 w-4.5" />} tone={critical > 0 ? "red" : "green"} />
        <StatCard label="High Risk"       value={highRisk}  sub={highRisk > 0 ? "Urgent review" : "None"}   icon={<Zap className="h-4.5 w-4.5" />}         tone={highRisk > 0 ? "amber" : "green"} />
        <StatCard label="Beds Occupied"   value={`${occupied}/${totalBeds}`}    sub={`${Math.round(occupied/totalBeds*100)}% occupancy`} icon={<BedDouble className="h-4.5 w-4.5" />} tone="teal"  />
        <StatCard label="Avg Ack Time"    value={analytics.avg_response_time_minutes ? `${analytics.avg_response_time_minutes}m` : "1.2m"} sub="SLA response" icon={<Clock className="h-4.5 w-4.5" />} tone="blue" />
      </div>

      {/* ═══════════════════════════════════════════
          Stage 5: Ward Risk Heatmap (Command Centre)
          ═══════════════════════════════════════════ */}
      <div className="rounded-3xl bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-premium)" }}>
        {/* Heatmap Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.94 0.04 255 / 0.4)" }}>
                <BedDouble className="h-4.5 w-4.5" style={{ color: "oklch(0.45 0.22 258)" }} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
                  Ward Bed Risk Heatmap
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Stage 5 · Each cell = 1 bed, color-coded by active NEWS2 risk
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { color: "bg-red-500", label: "Critical (RED)", pulse: true },
                { color: "bg-orange-400", label: "High Risk" },
                { color: "bg-amber-400", label: "Elevated" },
                { color: "bg-emerald-500", label: "Stable" },
                { color: "bg-slate-200", label: "Vacant" },
              ].map(({ color, label, pulse }) => (
                <div key={label} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                  <span className={`h-3 w-3 rounded-sm ${color} ${pulse ? "animate-pulse" : ""}`} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {analytics.ward_stats.map((w: any) => {
            const wardPatients = patients.filter(p => p.ward_id === w.ward_id);
            const wardCritical = wardPatients.filter(p => p.latest_risk_level === "RED").length;
            const wardHigh = wardPatients.filter(p => p.latest_risk_level === "ORANGE").length;
            const wardStatus = wardCritical > 0 ? "critical" : wardHigh > 0 ? "warning" : "success";

            return (
              <div key={w.ward_id} className="rounded-2xl border border-slate-200/60 bg-slate-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800" style={{ fontFamily: "var(--font-display)" }}>{w.ward_name}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{wardPatients.length} occupied</div>
                  </div>
                  <StatusPill tone={wardStatus}>
                    {wardCritical > 0 ? `${wardCritical} Critical` : wardHigh > 0 ? `${wardHigh} High` : "Stable"}
                  </StatusPill>
                </div>

                {/* Bed grid — 10 cells per ward */}
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const bedNum = `${w.ward_id}0${idx + 1}`;
                    const pat = wardPatients.find(p => p.bed_number === bedNum || p.bed_number === String(bedNum));
                    const risk = pat?.latest_risk_level || "Empty";
                    const c = BED_COLORS[risk] ?? BED_COLORS.Empty;

                    return (
                      <div
                        key={idx}
                        className={`h-8 rounded-lg flex items-center justify-center text-[9px] font-bold cursor-help relative group transition-all duration-200 hover:scale-110 hover:z-10 ${c.bg} ${c.text} ${c.ring} ${c.pulse ? "animate-pulse" : ""}`}
                        title={pat ? `${pat.full_name} · Bed ${bedNum} · NEWS2: ${pat.latest_news2_score ?? 0}` : `Bed ${bedNum} · Vacant`}
                      >
                        {idx + 1}
                        {pat && (
                          <div className="pointer-events-none hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <div className="w-44 rounded-xl bg-slate-900 text-white text-[10px] p-3 shadow-xl leading-relaxed">
                              <div className="font-bold border-b border-white/20 pb-1.5 mb-1.5">{pat.full_name}</div>
                              <div>Bed: {bedNum}</div>
                              <div>NEWS2: <span className="font-bold">{pat.latest_news2_score ?? 0}</span></div>
                              <div>Risk: <span className={`font-bold ${risk === "RED" ? "text-red-400" : risk === "ORANGE" ? "text-orange-400" : risk === "YELLOW" ? "text-yellow-400" : "text-emerald-400"}`}>{risk}</span></div>
                            </div>
                            <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts + High-Risk List */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Alert Volume Trend Chart */}
        <div className="rounded-3xl bg-white p-6" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.94 0.04 255 / 0.4)" }}>
              <TrendingUp className="h-4 w-4" style={{ color: "oklch(0.45 0.22 258)" }} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>Alert Volume Trend</div>
              <div className="text-[11px] text-slate-400 font-medium">Escalation counts across last 7 cycles</div>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.alert_volume_by_day}>
                <defs>
                  <linearGradient id="sapphireGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.45 0.22 258)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="oklch(0.45 0.22 258)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.008 240)" />
                <XAxis dataKey="date" stroke="oklch(0.52 0.025 255)" fontSize={10} fontWeight={600} />
                <YAxis stroke="oklch(0.52 0.025 255)" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.90 0.012 240)", boxShadow: "var(--shadow-md)", fontFamily: "var(--font-sans)", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="count" name="Alerts" stroke="oklch(0.45 0.22 258)" fill="url(#sapphireGrad)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* High Priority Oversight + Response SLAs */}
        <div className="rounded-3xl bg-white p-6 space-y-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-red-100">
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>Response SLA Windows</div>
              <div className="text-[11px] text-slate-400 font-medium">Clinical acknowledgment targets</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Red Escalation", target: "< 1.5 min", desc: "RRT dispatch", bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500" },
              { label: "Orange Review",  target: "< 15 min",  desc: "Doctor bedside", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", dot: "bg-orange-500" },
              { label: "Yellow Audit",  target: "< 30 min",  desc: "Reassessment", bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  dot: "bg-amber-400"  },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-3 text-center space-y-1.5`}>
                <div className={`flex items-center justify-center gap-1 text-[10px] font-bold ${s.text} uppercase tracking-wide`}>
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  {s.label}
                </div>
                <div className={`text-lg font-bold leading-none ${s.text}`} style={{ fontFamily: "var(--font-display)" }}>{s.target}</div>
                <div className="text-[10px] text-slate-500 font-medium">{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Top risk patients */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> High-Priority Patient Oversight
            </div>
            <div className="space-y-2">
              {analytics.top_risk_patients.slice(0, 4).map((rp: any) => (
                <Link key={rp.patient_id}
                  to={`/nurse/patient/${rp.patient_id}` as never}
                  className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition group">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${rp.risk_level === "RED" ? "bg-red-500 animate-pulse" : rp.risk_level === "ORANGE" ? "bg-orange-500" : "bg-amber-400"}`} />
                    <span className="font-semibold text-slate-800">{rp.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400">NEWS2: {rp.news2}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 transition" />
                  </div>
                </Link>
              ))}
              {analytics.top_risk_patients.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-400 bg-emerald-50 rounded-xl border border-emerald-100">
                  <Sparkles className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                  All wards stable — no active warnings
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts Feed */}
      {recentAlerts.length > 0 && (
        <div className="rounded-3xl bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>Active Escalation Queue</div>
                <div className="text-[11px] text-slate-400">{recentAlerts.length} unacknowledged alerts</div>
              </div>
            </div>
            <Link to="/admin/alerts" className="text-xs font-bold flex items-center gap-1 hover:underline" style={{ color: "oklch(0.45 0.22 258)" }}>
              View All <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAlerts.slice(0, 5).map((alert: any) => (
              <div key={alert.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${alert.risk_level === "RED" ? "bg-red-500 animate-pulse" : alert.risk_level === "ORANGE" ? "bg-orange-400" : "bg-amber-400"}`} />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{alert.patient_name || `Patient #${alert.patient_id}`}</div>
                    <div className="text-[11px] text-slate-400 font-medium">{alert.message}</div>
                  </div>
                </div>
                <StatusPill tone={riskTone(alert.risk_level as any)}>{alert.risk_level}</StatusPill>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}