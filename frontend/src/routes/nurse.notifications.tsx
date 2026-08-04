import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, BellRing, Clock, TrendingUp, Loader2 } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { getAlerts } from "@/lib/api";

export const Route = createFileRoute("/nurse/notifications")({ component: NotifPage });

function NotifPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async () => {
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-destructive/10 p-5 text-center text-destructive border border-destructive/20 max-w-md mx-auto mt-10">
        <h3 className="font-semibold text-lg">Failed to load notifications</h3>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  const [tab, setTab] = useState<"all" | "critical" | "warnings" | "acked">("all");

  const redAlerts = alerts.filter(a => a.risk_level === "RED" && a.status === "active");
  const orangeAlerts = alerts.filter(a => a.risk_level === "ORANGE" && a.status === "active");
  const yellowAlerts = alerts.filter(a => a.risk_level === "YELLOW" && a.status === "active");
  const acknowledgedAlerts = alerts.filter(a => a.status === "acknowledged");

  const filteredNotifications = alerts.filter(a => {
    if (tab === "critical") return (a.risk_level === "RED" || a.risk_level === "ORANGE") && a.status === "active";
    if (tab === "warnings") return a.risk_level === "YELLOW" && a.status === "active";
    if (tab === "acked") return a.status === "acknowledged";
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <SectionHeader title="Clinical Notifications Center" hint="Organized safety alerts, escalation logs, and shift warnings" />
      
      {/* Counters */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Tile icon={AlertTriangle} label="Critical RED" v={redAlerts.length} tone="critical" />
        <Tile icon={Clock} label="High ORANGE" v={orangeAlerts.length} tone="warning" />
        <Tile icon={BellRing} label="Watch YELLOW" v={yellowAlerts.length} tone="info" />
        <Tile icon={TrendingUp} label="Acknowledged" v={acknowledgedAlerts.length} tone="primary" />
      </div>

      {/* Category Tabs */}
      <Card className="p-3 flex items-center gap-2">
        {[
          { id: "all", label: `All Notifications (${alerts.length})` },
          { id: "critical", label: `🚨 Critical Alerts (${redAlerts.length + orangeAlerts.length})` },
          { id: "warnings", label: `⚡ Shift Warnings (${yellowAlerts.length})` },
          { id: "acked", label: `✅ Acknowledged (${acknowledgedAlerts.length})` }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </Card>

      {/* Filtered Notification Cards */}
      <Card className="p-4">
        {filteredNotifications.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No notifications found in this category.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredNotifications.map(a => {
              const severity = a.risk_level || "YELLOW";
              const tone = severity === "RED" ? "critical" : severity === "ORANGE" ? "warning" : "info";
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 px-3 hover:bg-slate-50 rounded-xl transition">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${severity === "RED" ? "bg-red-500 animate-pulse" : severity === "ORANGE" ? "bg-orange-500" : "bg-yellow-500"}`} />
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{a.message}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Patient: <span className="font-bold text-slate-700">{a.patient_name || "Bedside Monitor"}</span> · Triggered: {new Date(a.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={a.status === "active" ? "critical" : "success"}>{a.status}</StatusPill>
                    <StatusPill tone={tone}>{severity}</StatusPill>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Tile({ icon: Icon, label, v, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; v: number; tone: "critical"|"warning"|"info"|"primary" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-elegant transition">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-foreground">{v}</div>
      <div className="mt-2"><StatusPill tone={tone}>{tone}</StatusPill></div>
    </div>
  );
}