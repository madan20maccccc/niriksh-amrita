import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Filter, Loader2, CheckCircle2, Info, Eye, Smartphone } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { getAlerts, acknowledgeAlert, explainAlert, getWards } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/alerts")({ component: AlertsPage });

function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [sevFilter, setSevFilter] = useState<"All" | "RED" | "ORANGE" | "YELLOW">("All");
  
  // Explanation Modal/Dropdown state
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [alertExplanation, setAlertExplanation] = useState<any>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Acknowledge logic state
  const [ackAction, setAckAction] = useState("");
  const [ackingAlertId, setAckingAlertId] = useState<number | null>(null);
  const [wardPhoneMap, setWardPhoneMap] = useState<Record<number, string>>({});

  const loadAlerts = async () => {
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load clinical alerts database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    // Load ward doctor phone numbers for direct SMS buttons
    getWards().then((wards: any[]) => {
      const map: Record<number, string> = {};
      wards.forEach((w: any) => { if (w.doctor_phone) map[w.id] = w.doctor_phone; });
      setWardPhoneMap(map);
    }).catch(() => {});
  }, []);

  const handleExplainAlert = async (alertId: number) => {
    if (selectedAlertId === alertId) {
      setSelectedAlertId(null);
      setAlertExplanation(null);
      return;
    }
    
    setSelectedAlertId(alertId);
    setLoadingExplanation(true);
    try {
      const res = await explainAlert(alertId);
      setAlertExplanation(res);
    } catch (err: any) {
      console.error(err);
      setAlertExplanation({
        rule_name: "Failed to load explanation",
        rationale: err.message || "Server issue.",
        details: []
      });
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleAckAlert = async (alertId: number) => {
    setAckingAlertId(alertId);
    try {
      await acknowledgeAlert(alertId, ackAction || "Action taken by charge nurse/admin");
      setAckAction("");
      setAckingAlertId(null);
      toast.success("✅ Alert Acknowledged", {
        description: "Action logged. Alert status updated to acknowledged.",
      });
      loadAlerts();
    } catch (err: any) {
      toast.error("Failed to acknowledge alert", {
        description: err.message || "Please try again.",
      });
      setAckingAlertId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Connecting to safety monitor feeds...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20 shadow-card">
        <h3 className="font-display text-xl font-bold">Alert Feeds Offline</h3>
        <p className="mt-2 text-sm">{error}</p>
        <button 
          onClick={() => { setLoading(true); loadAlerts(); }}
          className="mt-4 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold"
        >
          Re-establish Connection
        </button>
      </div>
    );
  }

  const counts = {
    RED: alerts.filter(a => a.risk_level === "RED" && a.status === "active").length,
    ORANGE: alerts.filter(a => a.risk_level === "ORANGE" && a.status === "active").length,
    YELLOW: alerts.filter(a => a.risk_level === "YELLOW" && a.status === "active").length,
  };

  const filteredList = alerts.filter(a => {
    return sevFilter === "All" || a.risk_level === sevFilter;
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="Clinical Alerts Dashboard" hint="Hospital-wide warning flags and re-escalations" />
      
      {/* Counters */}
      <div className="grid grid-cols-3 gap-4">
        <Tile label="Active Red · Critical" value={counts.RED} tone="critical" />
        <Tile label="Active Orange · High" value={counts.ORANGE} tone="warning" />
        <Tile label="Active Yellow · Watch" value={counts.YELLOW} tone="info" />
      </div>

      {/* Filter box */}
      <Card className="p-4 flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select 
            value={sevFilter} 
            onChange={e => setSevFilter(e.target.value as any)} 
            className="bg-transparent outline-none font-semibold text-foreground"
          >
            <option value="All">Filter by Severity: All</option>
            <option value="RED">RED (Critical)</option>
            <option value="ORANGE">ORANGE (High)</option>
            <option value="YELLOW">YELLOW (Watch)</option>
          </select>
        </div>
      </Card>

      {/* Table & Explainability Sub-panels */}
      <Card className="overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center max-w-lg mx-auto my-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Info className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">Clinical Safety Feeds are Quiet</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              No active or historical alerts are currently logged in the database. All wards are operating within safe clinical baselines!
            </p>
            <div className="mt-5 p-4 rounded-xl border border-primary/20 bg-primary-soft/40 text-left text-xs text-foreground space-y-2.5">
              <div className="font-bold text-primary flex items-center gap-1 text-sm">
                <span>💡</span> How to Simulate a Clinical Alert:
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
                <li>Log out of this Admin account and sign in as a <strong className="text-foreground">Nurse</strong> (e.g. <code>nurse1@amrita.org</code> / <code>amrita123</code>).</li>
                <li>Go to <strong className="text-foreground">My Patients</strong>, click on any patient, and select <strong className="text-foreground">Enter Vitals</strong>.</li>
                <li>Input abnormal parameters (e.g. Heart Rate <strong className="text-red-600">135 bpm</strong>, SpO₂ <strong className="text-red-600">88%</strong>, Respiratory Rate <strong className="text-red-600">26/min</strong>).</li>
                <li>Click <strong className="text-foreground">Save Vitals</strong>. The system's multi-agent EWS engine will immediately fire a critical alert and trigger the telemetry alarm!</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left">Severity</th>
                  <th className="px-5 py-3 text-left">Alert Detail / Message</th>
                  <th className="px-5 py-3 text-left">Trigger Time</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredList.map(a => {
                  const isSelected = selectedAlertId === a.id;
                  const severity = a.risk_level || "YELLOW";
                  const tone = severity === "RED" ? "critical" : severity === "ORANGE" ? "warning" : "info";
                  
                  return (
                    <React.Fragment key={a.id}>
                      <tr className="hover:bg-slate-50/50">
                        <td className="px-5 py-4">
                          <StatusPill tone={tone as any}>{severity}</StatusPill>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-foreground">{a.message}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                            Type: {a.alert_type}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                          {new Date(a.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill tone={a.status === "active" ? "critical" : a.status === "acknowledged" ? "warning" : "success"}>
                            {a.status}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            {/* Direct SMS via phone — 100% FREE */}
                            {(a.risk_level === "RED" || a.risk_level === "ORANGE") && (
                              <a
                                href={`sms:${wardPhoneMap[a.ward_id] || ""}?body=${encodeURIComponent(`URGENT NirikshAmrita ALERT\nPatient: ${a.patient_name || "Patient"}\nRisk: ${a.risk_level}\n${a.message}\nImmediate review required.`)}`}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
                                title="Send direct SMS via your phone — FREE"
                              >
                                <Smartphone className="h-3.5 w-3.5" /> SMS Doctor
                              </a>
                            )}
                            <button
                              onClick={() => handleExplainAlert(a.id)}
                              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted inline-flex items-center gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" /> Explain
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Explainability Dropdown */}
                      {isSelected && (
                        <tr>
                          <td colSpan={5} className="bg-slate-50/60 px-5 py-4 border-t border-b border-border">
                            {loadingExplanation ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                                <Loader2 className="h-4 w-4 animate-spin" /> Fetching diagnostics...
                              </div>
                            ) : alertExplanation ? (
                              <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] text-sm animate-in fade-in duration-300">
                                <div className="space-y-2">
                                  <div className="font-bold text-foreground flex items-center gap-1.5">
                                    <Info className="h-4.5 w-4.5 text-primary" />
                                    {alertExplanation.rule_name}
                                  </div>
                                  <p className="text-muted-foreground leading-relaxed">
                                    {alertExplanation.rationale}
                                  </p>
                                  <ul className="list-disc list-inside text-xs text-foreground space-y-1 bg-white p-3 rounded-xl border border-border shadow-sm">
                                    {alertExplanation.details.map((d: string, idx: number) => (
                                      <li key={idx}>{d}</li>
                                    ))}
                                  </ul>
                                </div>
                                
                                <div className="flex flex-col justify-between h-full bg-white p-3.5 rounded-xl border border-border shadow-sm">
                                  <div className="space-y-1">
                                    <div className="text-[10px] uppercase font-bold text-primary tracking-wider">Required Nursing Action</div>
                                    <p className="text-xs text-foreground font-semibold leading-relaxed">
                                      {alertExplanation.action_required}
                                    </p>
                                  </div>
                                  
                                  {a.status === "active" && (
                                    <div className="mt-3 space-y-2">
                                      <input 
                                        type="text" 
                                        value={ackAction} 
                                        onChange={e => setAckAction(e.target.value)} 
                                        placeholder="Add acknowledgement remarks..." 
                                        className="w-full rounded-lg border border-input bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                                      />
                                      <button 
                                        onClick={() => handleAckAlert(a.id)}
                                        disabled={ackingAlertId === a.id}
                                        className="w-full rounded-lg bg-green-600 hover:bg-green-700 text-white py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                                      >
                                        {ackingAlertId === a.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                        )}
                                        Acknowledge Alert
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">Could not load explanation record.</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}


function Tile({ label, value, tone }: { label: string; value: number; tone: "critical" | "warning" | "info" }) {
  const bg = tone === "critical" ? "from-[color-mix(in_oklab,var(--color-critical)_8%,transparent)]"
    : tone === "warning" ? "from-[color-mix(in_oklab,var(--color-warning)_8%,transparent)]"
    : "from-[color-mix(in_oklab,var(--color-info)_8%,transparent)]";
  return (
    <div className={"rounded-2xl border border-border bg-gradient-to-br to-white p-5 shadow-card transition duration-300 hover:shadow-elegant " + bg}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-foreground">{value}</div>
    </div>
  );
}