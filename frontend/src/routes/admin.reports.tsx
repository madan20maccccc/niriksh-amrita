import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, RefreshCw, TrendingUp, Activity } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Card, SectionHeader } from "@/components/ui/section";
import { getAnalyticsSummary } from "@/lib/api";

export const Route = createFileRoute("/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAnalyticsSummary();
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Compiling clinical safety reports...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20">
        <h3 className="font-display text-xl font-bold">Analytics Offline</h3>
        <p className="mt-2 text-sm">{error || "Could not retrieve analytics data."}</p>
        <button onClick={loadData} className="mt-4 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold">Retry</button>
      </div>
    );
  }

  // Compute ward-level risk distribution for pie chart
  const riskDistribution = [
    { name: "GREEN", value: analytics.ward_stats.reduce((s: number, w: any) => s + w.green_count, 0), color: "#22c55e" },
    { name: "YELLOW", value: analytics.ward_stats.reduce((s: number, w: any) => s + w.yellow_count, 0), color: "#eab308" },
    { name: "ORANGE", value: analytics.ward_stats.reduce((s: number, w: any) => s + w.orange_count, 0), color: "#f97316" },
    { name: "RED", value: analytics.ward_stats.reduce((s: number, w: any) => s + w.red_count, 0), color: "#ef4444" },
  ];

  const totalAlerts7d = analytics.alert_volume_by_day.reduce((s: number, d: any) => s + d.count, 0);
  const avgAlertsPerDay = totalAlerts7d > 0 ? Math.round(totalAlerts7d / 7) : 0;

  // Ward occupancy bar chart data
  const wardOccupancyData = analytics.ward_stats.map((w: any) => ({
    name: w.ward_name.length > 8 ? w.ward_name.slice(0, 8) + "…" : w.ward_name,
    patients: w.total_patients,
    alerts: w.active_alerts,
    avgNEWS2: w.avg_news2 || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Clinical Safety Reports" hint="Real-time operational analytics from NirikshAmrita" />
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-white hover:bg-muted shadow-sm">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm hover:bg-muted">
            <FileText className="h-4 w-4" /> Export PDF
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm hover:bg-muted">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active Patients", value: analytics.total_patients, icon: Activity, tone: "text-primary" },
          { label: "Active Alerts", value: analytics.total_active_alerts, icon: TrendingUp, tone: analytics.total_active_alerts > 0 ? "text-red-600" : "text-green-600" },
          { label: "Alerts (7 days)", value: totalAlerts7d, icon: FileText, tone: "text-orange-500" },
          {
            label: "Avg Response",
            value: analytics.avg_response_time_minutes
              ? `${analytics.avg_response_time_minutes} min`
              : "—",
            icon: RefreshCw,
            tone: "text-blue-600"
          },
        ].map(s => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</div>
              <s.icon className={`h-4 w-4 ${s.tone}`} />
            </div>
            <div className={`font-display text-3xl font-bold ${s.tone}`}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alert Volume Trend */}
        <Card className="p-5">
          <SectionHeader
            title="Alert Volume — Last 7 Days"
            hint={`${totalAlerts7d} total alerts · avg ${avgAlertsPerDay}/day`}
          />
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.alert_volume_by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11}
                  tickFormatter={d => new Date(d).toLocaleDateString("en-IN", { weekday: "short" })} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }}
                  labelFormatter={d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                />
                <Bar dataKey="count" name="Alerts" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Risk Distribution Pie */}
        <Card className="p-5">
          <SectionHeader title="Patient Risk Distribution" hint="Across all active wards" />
          <div className="flex items-center gap-6 mt-4">
            <div className="h-52 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {riskDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }}
                    formatter={(value: any, name: any) => [`${value} patients`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {riskDistribution.map(r => (
                <div key={r.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: r.color }} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.value} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Ward Performance Table */}
      <Card className="p-5">
        <SectionHeader title="Ward-Level Performance" hint="Patient load · alert activity · avg NEWS2 score" />
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wardOccupancyData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={10} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
              <Bar dataKey="patients" name="Patients" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="alerts" name="Active Alerts" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ward table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Ward</th>
                <th className="px-4 py-2 text-center">Patients</th>
                <th className="px-4 py-2 text-center">GREEN</th>
                <th className="px-4 py-2 text-center">YELLOW</th>
                <th className="px-4 py-2 text-center">ORANGE</th>
                <th className="px-4 py-2 text-center text-red-600">RED</th>
                <th className="px-4 py-2 text-center">Active Alerts</th>
                <th className="px-4 py-2 text-center">Avg NEWS2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {analytics.ward_stats.map((w: any) => (
                <tr key={w.ward_id} className="hover:bg-primary-soft/20 transition">
                  <td className="px-4 py-3 font-semibold text-foreground">{w.ward_name}</td>
                  <td className="px-4 py-3 text-center">{w.total_patients}</td>
                  <td className="px-4 py-3 text-center text-green-600 font-medium">{w.green_count}</td>
                  <td className="px-4 py-3 text-center text-yellow-600 font-medium">{w.yellow_count}</td>
                  <td className="px-4 py-3 text-center text-orange-500 font-medium">{w.orange_count}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-bold">{w.red_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${w.active_alerts > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
                      {w.active_alerts}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">
                    {w.avg_news2 !== null && w.avg_news2 !== undefined ? (
                      <span className={`font-bold ${w.avg_news2 >= 7 ? "text-red-600" : w.avg_news2 >= 5 ? "text-orange-500" : "text-foreground"}`}>
                        {w.avg_news2}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top Risk Patients */}
      {analytics.top_risk_patients.length > 0 && (
        <Card className="p-5">
          <SectionHeader title="Highest-Risk Patients" hint="By NEWS2 score (clinical early warning)" />
          <div className="mt-4 space-y-3">
            {analytics.top_risk_patients.map((p: any, i: number) => (
              <div key={p.patient_id} className="flex items-center gap-4 rounded-xl border border-border bg-background/60 p-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  #{i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">NEWS2 Score: <span className="font-bold text-foreground">{p.news2}</span></div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  p.risk_level === "RED" ? "bg-red-100 text-red-700" :
                  p.risk_level === "ORANGE" ? "bg-orange-100 text-orange-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {p.risk_level}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Download Archive */}
      <Card className="p-5">
        <SectionHeader title="Report Archive" hint="Auto-generated clinical safety documents" />
        <ul className="divide-y divide-border mt-4">
          {[
            "Clinical Safety Summary — Morning Shift",
            "Ward Risk Status Report",
            "Alert Response Time Analysis",
            "Nursing Staff Coverage Report",
            "High-Risk Patient Watch List",
          ].map((t, i) => (
            <li key={t} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{t}</div>
                  <div className="text-xs text-muted-foreground">
                    Generated {i === 0 ? "today" : `${i} day${i > 1 ? "s" : ""} ago`} · Auto-compiled
                  </div>
                </div>
              </div>
              <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm hover:bg-muted">
                <Download className="h-4 w-4" /> Download
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}