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

  const redAlerts = alerts.filter(a => a.risk_level === "RED" && a.status === "active");
  const orangeAlerts = alerts.filter(a => a.risk_level === "ORANGE" && a.status === "active");
  const yellowAlerts = alerts.filter(a => a.risk_level === "YELLOW" && a.status === "active");
  const acknowledgedAlerts = alerts.filter(a => a.status === "acknowledged");

  return (
    <div className="space-y-6">
      <SectionHeader title="Clinical Notifications" hint="Safety warnings, re-escalations and audit alerts" />
      <div className="grid gap-4 sm:grid-cols-4">
        <Tile icon={AlertTriangle} label="Critical RED Alerts" v={redAlerts.length} tone="critical" />
        <Tile icon={Clock} label="High ORANGE Alerts" v={orangeAlerts.length} tone="warning" />
        <Tile icon={BellRing} label="Watch YELLOW Alerts" v={yellowAlerts.length} tone="info" />
        <Tile icon={TrendingUp} label="Acknowledged" v={acknowledgedAlerts.length} tone="primary" />
      </div>
      <Card className="p-4">
        {alerts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No clinical notifications issued on this shift.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.slice(0, 15).map(a => {
              const severity = a.risk_level || "YELLOW";
              const tone = severity === "RED" ? "critical" : severity === "ORANGE" ? "warning" : "info";
              return (
                <li key={a.id} className="flex items-center justify-between py-3.5 hover:bg-slate-50/50 px-2 rounded-lg transition">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{a.message}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Type: <span className="capitalize font-medium">{a.alert_type}</span> · Issued: {new Date(a.created_at).toLocaleString()}
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