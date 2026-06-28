import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, AlertTriangle, BedDouble, Hospital, Plus, Sparkles, UserCog, Users, Loader2, ArrowRight
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart,
} from "recharts";
import { toast } from "sonner";
import { Card, SectionHeader, Stat } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { getAnalyticsSummary, getAlerts, getWsUrl } from "@/lib/api";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      const [summary, alertsData] = await Promise.all([
        getAnalyticsSummary(),
        getAlerts(undefined, undefined, "active")
      ]);
      setAnalytics(summary);
      setRecentAlerts(alertsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load hospital operations data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // WebSocket real-time listener (Agent 12 Integration)
    const ws = new WebSocket(getWsUrl("/ws/admin"));
    
    ws.onopen = () => {
      console.log("[WebSocket] Connected to Admin Command Centre feed.");
    };

    ws.onmessage = (event) => {
      console.log("[WebSocket] Message received:", event.data);
      try {
        const payload = JSON.parse(event.data);
        
        // Show live toast for new critical alerts
        if (payload.event === "new_alert" || payload.type === "new_alert") {
          toast.error(`CRITICAL Breaches: ${payload.message}`, {
            description: `Bed ${payload.bed_number} · NEWS2 score: ${payload.news2_score}`,
            duration: 8000
          });
        }
      } catch (e) {
        // Fallback for simple string messages
        toast.info(`Hospital Event: ${event.data}`);
      }
      
      // Auto-reload database logs
      loadDashboardData();
    };

    ws.onclose = () => {
      console.log("[WebSocket] Disconnected from Admin Command Centre feed.");
    };

    return () => {
      ws.close();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Connecting to Amrita Operations Center...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20 shadow-card">
        <h3 className="font-display text-xl font-bold">Operations Hub Offline</h3>
        <p className="mt-2 text-sm">{error || "Could not retrieve hospital statistics."}</p>
        <button 
          onClick={() => { setLoading(true); loadDashboardData(); }}
          className="mt-4 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const occupied = analytics.ward_stats.reduce((s: number, w: any) => s + w.total_patients, 0);
  // Cap standard total beds to show realistic occupancy
  const totalBeds = analytics.ward_stats.length * 20;

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-white to-primary-soft/50 p-5 shadow-card animate-in fade-in duration-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <Hospital className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Amrita Hospital · Status</div>
              <div className="font-display text-lg text-foreground font-semibold">
                Operational across {analytics.ward_stats.length} active wards
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill tone="success">Operational</StatusPill>
            <div className="text-right text-xs text-muted-foreground">
              <div>Last updated</div>
              <div className="font-medium text-foreground">{new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Link to="/admin/patients" className="block transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
          <Stat label="Active Patients" value={analytics.total_patients} hint="under surveillance" tone="primary" />
        </Link>
        <Link to="/admin/wards" className="block transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
          <Stat label="Active Wards" value={analytics.ward_stats.length} />
        </Link>
        <Link to="/admin/alerts" className="block transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
          <Stat label="Active Alerts" value={analytics.total_active_alerts} hint="requiring response" tone={analytics.total_active_alerts > 0 ? "critical" : "primary"} />
        </Link>
        <div className="block">
          <Stat label="Avg Response" value={analytics.avg_response_time_minutes ? `${analytics.avg_response_time_minutes} min` : "N/A"} hint="alert acknowledgment" tone="info" />
        </div>
        <Link to="/admin/patients" className="block transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
          <Stat label="Beds Occupied" value={`${occupied}/${totalBeds}`} hint={`${Math.round(occupied/totalBeds*100)}% occupancy`} tone="info" />
        </Link>
        <div className="block">
          <Stat label="Watch level" value={analytics.total_active_alerts > 3 ? "STRETCHED" : "NOMINAL"} tone={analytics.total_active_alerts > 3 ? "warning" : "success"} />
        </div>
      </div>

      {/* Ward risk + AI insight */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <SectionHeader title="Live Ward Risk Overview" hint="Aggregated from live NEWS2 vitals" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-4">
            {analytics.ward_stats.map((w: any) => {
              const activeCount = w.red_count + w.orange_count;
              const status = activeCount > 2 ? "Critical" : activeCount > 0 ? "Strained" : "Operational";
              const tone = activeCount > 2 ? "critical" : activeCount > 0 ? "warning" : "success";
              const calculatedRisk = Math.min(100, Math.round((w.red_count * 30 + w.orange_count * 15 + w.yellow_count * 5 + w.green_count * 1) / Math.max(1, w.total_patients) * 10));

              return (
                <Link 
                  key={w.ward_id} 
                  to="/admin/wards" 
                  search={{ wardId: w.ward_id }} 
                  className="rounded-xl border border-border bg-background/60 p-4 shadow-sm flex flex-col justify-between transition transform hover:scale-[1.02] hover:border-primary/20 active:scale-[0.98] cursor-pointer min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0 w-full">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">WARD-0{w.ward_id}</div>
                      <div className="font-display text-base font-bold text-foreground truncate" title={w.ward_name}>{w.ward_name}</div>
                    </div>
                    <StatusPill tone={tone} className="shrink-0">{status}</StatusPill>
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    {w.total_patients} patients · {w.active_alerts} active alerts
                  </div>
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full gradient-primary" style={{ width: `${calculatedRisk}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-semibold">
                      <span>Risk Level</span>
                      <span>{calculatedRisk}%</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* AI Insight Card */}
        <Card className="overflow-hidden p-0 flex flex-col justify-between">
          <div className="gradient-primary p-5 text-primary-foreground flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="h-4 w-4" /> AI Insights
            </div>
            <p className="mt-3 font-display text-base leading-snug">
              {analytics.total_active_alerts > 0 
                ? `${analytics.total_active_alerts} active alerts flagged. Verify response logs immediately.`
                : "All parameters are stable. No active alerts."
              }
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border bg-white border-t border-border">
            {[
              { l: "Surveillance Active", v: `${analytics.total_patients} patients` },
              { l: "Alerts Issued", v: `${analytics.alert_volume_by_day.reduce((acc: number, item: any) => acc + item.count, 0)} alerts` },
              { l: "Avg response", v: analytics.avg_response_time_minutes ? `${analytics.avg_response_time_minutes} min` : "N/A" },
            ].map(s => (
              <div key={s.l} className="p-4 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">{s.l}</div>
                <div className="mt-1 font-display text-base font-bold text-foreground">{s.v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Critical events + Quick actions */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Live Alerts Feed */}
        <Card className="p-5">
          <SectionHeader 
            title="Recent Critical Events" 
            hint="Real-time clinical escalation log"
            action={<Link to="/admin/alerts" className="text-sm font-semibold text-primary hover:underline">View all alerts</Link>} 
          />
          <div className="divide-y divide-border mt-4">
            {recentAlerts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
                No active critical alerts on this shift. Wards are stable.
              </div>
            ) : (
              recentAlerts.slice(0, 6).map(a => (
                <Link 
                  key={a.id} 
                  to={`/nurse/patient/${a.patient_id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3.5 hover:bg-slate-50/50 rounded-xl px-2 transition cursor-pointer"
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${
                    a.risk_level === "RED" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                  }`}>
                    <AlertTriangle className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{a.message}</div>
                    <div className="text-xs text-muted-foreground">
                      Bed {a.details ? JSON.parse(a.details.replace(/'/g, '"')).bed || "N/A" : "N/A"} · Type: <span className="capitalize font-medium">{a.alert_type}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="mt-1">
                      <StatusPill tone={a.status === "active" ? "critical" : "warning"}>
                        {a.status}
                      </StatusPill>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Quick Actions and Stats */}
        <Card className="p-5">
          <SectionHeader title="Hospital Management" hint="Surveillance tasks" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[
              { to: "/admin/wards", icon: Hospital, label: "Manage Wards" },
              { to: "/admin/nurses", icon: UserCog, label: "Nurse Rosters" },
              { to: "/admin/patients", icon: BedDouble, label: "Patients List" },
              { to: "/admin/reports", icon: Users, label: "Clinical Safety Logs" },
            ].map(a => (
              <Link 
                key={a.label} 
                to={a.to as any}
                className="group flex items-center gap-3 rounded-xl border border-border bg-white p-3 transition hover:border-primary/30 hover:bg-primary-soft/50 shadow-sm"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-white">
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">{a.label}</span>
              </Link>
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Highest-Risk Patients</h4>
            <div className="mt-3 space-y-2">
              {analytics.top_risk_patients.length === 0 ? (
                <p className="text-xs text-muted-foreground">No high-risk patients tracked.</p>
              ) : (
                analytics.top_risk_patients.map((rp: any) => (
                  <div key={rp.patient_id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50 border border-border">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        rp.risk_level === "RED" ? "bg-red-500 animate-pulse" : rp.risk_level === "ORANGE" ? "bg-orange-500" : "bg-yellow-500"
                      }`} />
                      <span className="font-medium text-foreground">{rp.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-semibold">NEWS2: {rp.news2}</span>
                      <Link to={`/nurse/patient/${rp.patient_id}` as never}>
                        <ArrowRight className="h-4 w-4 text-primary hover:translate-x-0.5 transition" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Alert Volume Trends" hint="Last 7 Days" />
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.alert_volume_by_day}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
                <Area type="monotone" dataKey="count" name="Total Alerts" stroke="var(--color-primary)" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Target Response Windows" hint="Goal acknowledgement times" />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { l: "Red Alert", v: "1.5 Min", t: "critical" as const },
              { l: "Orange Alert", v: "15 Min", t: "warning" as const },
              { l: "Yellow Alert", v: "30 Min", t: "info" as const },
            ].map(s => (
              <div key={s.l} className="rounded-xl border border-border bg-background/60 p-4 text-center flex flex-col items-center justify-center shadow-sm">
                <StatusPill tone={s.t}>{s.l}</StatusPill>
                <div className="mt-2 font-display text-lg font-bold text-foreground">{s.v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}