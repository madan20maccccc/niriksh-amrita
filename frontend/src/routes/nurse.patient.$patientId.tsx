import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  Sparkles, Loader2, Send, AlertTriangle, HelpCircle, 
  TrendingUp, TrendingDown, Eye, CheckCircle2, Info
} from "lucide-react";
import { 
  CartesianGrid, Line, LineChart, ResponsiveContainer, 
  Tooltip, XAxis, YAxis, Legend 
} from "recharts";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill, riskTone } from "@/components/ui/status-pill";
import { 
  getPatient, getVitalsHistory, getAlerts, 
  getPatientPredictions, askPatientRag, explainAlert,
  acknowledgeAlert 
} from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/nurse/patient/$patientId")({ component: PatientDetail });

function PatientDetail() {
  const { patientId } = useParams({ from: "/nurse/patient/$patientId" });
  const pId = parseInt(patientId);

  const [patient, setPatient] = useState<any>(null);
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // RAG Chatbot State
  const [query, setQuery] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: "Hello! I am your clinical safety assistant. Ask me anything about this patient's vitals, alert history, or parameters." }
  ]);
  const [sendingRag, setSendingRag] = useState(false);

  // Alert Explanation State
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [alertExplanation, setAlertExplanation] = useState<any>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Acknowledge Action State
  const [ackAction, setAckAction] = useState("");
  const [ackingAlertId, setAckingAlertId] = useState<number | null>(null);

  const loadData = async () => {
    try {
      const [pData, vData, aData, predData] = await Promise.all([
        getPatient(pId),
        getVitalsHistory(pId, 20),
        getAlerts(undefined, pId),
        getPatientPredictions(pId).catch(() => null)
      ]);
      
      setPatient(pData);
      setVitalsHistory(vData);
      setAlerts(aData);
      setPredictions(predData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load patient records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll every 10 seconds for real-time updates of vitals, alerts, and predictions
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [pId]);

  const handleSendRag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userText = query;
    setChatLog(prev => [...prev, { sender: "user", text: userText }]);
    setQuery("");
    setSendingRag(true);

    try {
      const res = await askPatientRag(pId, userText);
      setChatLog(prev => [...prev, { sender: "ai", text: res.answer }]);
    } catch (err: any) {
      setChatLog(prev => [...prev, { sender: "ai", text: `Error generating answer: ${err.message || "Server issue."}` }]);
    } finally {
      setSendingRag(false);
    }
  };

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
        rationale: err.message || "Server error occurred.",
        details: []
      });
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleAckAlert = async (alertId: number) => {
    setAckingAlertId(alertId);
    try {
      const result = await acknowledgeAlert(alertId, ackAction || "Vitals verified, clinician notified");
      setAckAction("");
      setAckingAlertId(null);
      // Reload alerts to show updated status
      const aData = await getAlerts(undefined, pId);
      setAlerts(aData);
      // Explain what the system did next
      const riskLevel = result?.risk_level || "";
      if (riskLevel === "RED" || riskLevel === "ORANGE") {
        toast.success("✅ Alert Acknowledged", {
          description: "Your response has been logged. The duty doctor has been notified. Continue monitoring the patient closely.",
          duration: 8000,
        });
      } else {
        toast.success("✅ Alert Acknowledged", {
          description: "Your response is recorded. The alert is now resolved in the system. Keep monitoring the patient.",
          duration: 6000,
        });
      }
    } catch (err: any) {
      toast.error("Failed to acknowledge alert", {
        description: err.message || "Please try again or contact your supervisor.",
      });
      setAckingAlertId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading clinical database...</p>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20 shadow-card">
        <h3 className="font-display text-xl font-semibold">Database Error</h3>
        <p className="mt-2 text-sm">{error || "Patient record could not be found."}</p>
        <Link to="/nurse/patients" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">← Back to Patients</Link>
      </div>
    );
  }

  // Formatting chart data from database logs (oldest to newest)
  const chartData = [...vitalsHistory].reverse().map((v, index) => ({
    shift: `${v.shift} (#${index + 1})`,
    date: new Date(v.recorded_at).toLocaleDateString([], { month: "short", day: "numeric" }),
    bp_sys: v.systolic_bp,
    bp_dia: v.diastolic_bp,
    hr: v.heart_rate,
    spo2: v.spo2,
    rr: v.respiratory_rate,
    sugar: v.blood_glucose,
    temp: v.temperature,
  }));

  // Fetch the latest recorded vital
  const latestVital = vitalsHistory[0] || {};
  const risk = latestVital.risk_level || "LOW";
  const news2 = latestVital.news2_score !== undefined ? latestVital.news2_score : "N/A";

  // Check if there are active predictions
  const predictionCards = predictions?.can_predict && predictions.predictions 
    ? Object.keys(predictions.predictions).map((key: string) => {
        const item = predictions.predictions[key];
        const highPred = item.high_threshold_prediction;
        const lowPred = item.low_threshold_prediction;
        
        return {
          vital: key,
          high: highPred?.can_predict && highPred.is_approaching ? highPred : null,
          low: lowPred?.can_predict && lowPred.is_approaching ? lowPred : null
        };
      }).filter(p => p.high || p.low)
    : [];

  return (
    <div className="space-y-6">
      <Link to="/nurse/patients" className="text-sm text-primary hover:underline font-semibold flex items-center gap-1">
        ← Back to my patients
      </Link>

      {/* Patient Profile Card */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary-soft text-2xl font-semibold text-primary">
              {patient.full_name[0]}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{patient.patient_id}</div>
              <h2 className="font-display text-2xl font-bold text-foreground">{patient.full_name}</h2>
              <div className="mt-1 text-sm text-muted-foreground">
                {patient.age} years old · {patient.gender === "M" ? "Male" : "Female"} · Diagnosed with: <strong className="text-foreground">{patient.primary_diagnosis}</strong>
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                <span>Bed {patient.bed_number}</span>
                <span>·</span>
                <span>Admitted: {new Date(patient.admission_date).toLocaleDateString()}</span>
                {patient.diabetes && <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-[10px] font-bold">DIABETIC</span>}
                {patient.copd && <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-bold">COPD</span>}
                {patient.hypertension && <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[10px] font-bold">HYPERTENSION</span>}
                {patient.post_surgery && <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-bold">POST-OP</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone={riskTone(risk.toLowerCase() as any)}>{risk} risk (NEWS2: {news2})</StatusPill>
            <Link to={`/nurse/vitals/${patient.id}` as never} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:bg-primary/95">
              Enter vitals
            </Link>
            <Link to={`/nurse/sbar/${patient.id}` as never} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm hover:bg-muted font-medium">
              SBAR handover
            </Link>
          </div>
        </div>
      </Card>

      {/* Vitals Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Blood Pressure", latestVital.systolic_bp && latestVital.diastolic_bp ? `${Math.round(latestVital.systolic_bp)}/${Math.round(latestVital.diastolic_bp)}` : "N/A", "mmHg"],
          ["Heart Rate", latestVital.heart_rate ? `${Math.round(latestVital.heart_rate)}` : "N/A", "bpm"],
          ["Oxygen (SpO₂)", latestVital.spo2 ? `${Math.round(latestVital.spo2)}` : "N/A", "%"],
          ["Temperature", latestVital.temperature ? `${latestVital.temperature}` : "N/A", "°C"],
          ["Blood Glucose", latestVital.blood_glucose ? `${Math.round(latestVital.blood_glucose)}` : "N/A", "mg/dL"],
          ["Respiratory Rate", latestVital.respiratory_rate ? `${Math.round(latestVital.respiratory_rate)}` : "N/A", "/min"],
          ["Consciousness", latestVital.consciousness || "Alert", "AVPU"],
          ["Urine Output", latestVital.urine_output ? `${latestVital.urine_output}` : "N/A", "ml/shift"],
        ].map(([l, v, u]) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-4 shadow-card flex flex-col justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-2xl font-bold text-foreground">{v}</span>
              <span className="text-xs text-muted-foreground">{u}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Predictions Banner (Innovation 1) */}
      {predictionCards.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 p-5 ring-1 ring-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-display text-base font-semibold text-amber-900">Projected Vital Deterioration Trends</h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                Linear regression modeling of shift vital entries suggests the following boundary breaches if the current trajectory is left untreated:
              </p>
              <ul className="mt-2 list-disc list-inside text-sm text-amber-950 space-y-1">
                {predictionCards.map((p, i) => (
                  <li key={i} className="font-medium">
                    {p.high && p.high.message}
                    {p.low && p.low.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Vitals History Line Charts */}
      {chartData.length >= 2 ? (
        <div className="grid gap-6 md:grid-cols-2">
          <TrendCard title="Hemodynamics: BP & Heart Rate" keys={["bp_sys", "bp_dia", "hr"]} colors={["#ef4444", "#3b82f6", "#10b981"]} chartData={chartData} />
          <TrendCard title="Respiration & Saturation: SpO₂ & RR" keys={["spo2", "rr"]} colors={["#06b6d4", "#f59e0b"]} chartData={chartData} />
          <TrendCard title="Metabolic: Blood Glucose" keys={["sugar"]} colors={["#8b5cf6"]} chartData={chartData} />
          <TrendCard title="Thermal Status: Temperature" keys={["temp"]} colors={["#ec4899"]} chartData={chartData} />
        </div>
      ) : (
        <Card className="p-8 text-center text-muted-foreground border-dashed border-2">
          Charts will render once a minimum of 2 sets of vitals logs are recorded.
        </Card>
      )}

      {/* Alerts Timeline & Explainability Panel (Innovation 3) */}
      <Card className="p-5">
        <SectionHeader title="Shift Alert & Escalation Feed" hint="Real-time alert status and rule checks" />
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No active or historical alerts generated for this patient.
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map(a => {
              const isSelected = selectedAlertId === a.id;
              const isResolved = a.status === "resolved";
              const isAcknowledged = a.status === "acknowledged";
              
              return (
                <div key={a.id} className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
                  <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-8 w-8 place-items-center rounded-lg ${
                        a.risk_level === "RED" ? "bg-red-100 text-red-700" : a.risk_level === "ORANGE" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        <AlertTriangle className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{a.message}</div>
                        <div className="text-xs text-muted-foreground">
                          Type: <span className="capitalize font-medium">{a.alert_type}</span> · Issued: {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <StatusPill tone={a.status === "active" ? "critical" : a.status === "acknowledged" ? "warning" : "success"}>
                        {a.status}
                      </StatusPill>
                      <button 
                        onClick={() => handleExplainAlert(a.id)}
                        className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" /> 
                        {isSelected ? "Hide details" : "Explain Alert"}
                      </button>
                    </div>
                  </div>

                  {/* Explainability Dropdown */}
                  {isSelected && (
                    <div className="p-4 border-t border-border bg-slate-50/50">
                      {loadingExplanation ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 justify-center">
                          <Loader2 className="h-4.5 w-4.5 animate-spin" /> Retrieving clinical rule rationales...
                        </div>
                      ) : alertExplanation ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <Info className="h-4.5 w-4.5 text-primary mt-0.5" />
                            <div>
                              <div className="text-xs uppercase tracking-wider text-muted-foreground">Rule Category</div>
                              <div className="text-sm font-semibold text-foreground">{alertExplanation.rule_name}</div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-xs uppercase tracking-wider text-muted-foreground">Clinical Rationale</div>
                            <p className="text-sm text-foreground mt-0.5 leading-relaxed">{alertExplanation.rationale}</p>
                          </div>
                          
                          <div>
                            <div className="text-xs uppercase tracking-wider text-muted-foreground">Trigger Diagnostics</div>
                            <ul className="mt-1 list-disc list-inside text-sm text-foreground space-y-1">
                              {alertExplanation.details.map((d: string, idx: number) => (
                                <li key={idx}>{d}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="rounded-lg bg-primary-soft p-3 ring-1 ring-primary/10">
                            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Required Action</div>
                            <p className="text-xs text-foreground mt-1 font-medium">{alertExplanation.action_required}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground py-2 text-center">Failed to load rule details.</div>
                      )}
                    </div>
                  )}

                  {/* Acknowledge Action Box */}
                  {a.status === "active" && (
                    <div className="p-4 border-t border-border bg-slate-50/50 flex flex-wrap gap-2 items-center">
                      <input 
                        type="text" 
                        value={ackAction} 
                        onChange={e => setAckAction(e.target.value)} 
                        placeholder="Describe action taken (e.g. verified SpO2, administered insulin)..." 
                        className="flex-1 rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button 
                        onClick={() => handleAckAlert(a.id)}
                        disabled={ackingAlertId === a.id}
                        className="rounded-xl bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-semibold flex items-center gap-1.5"
                      >
                        {ackingAlertId === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Acknowledge Alert
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Alert Workflow Guide */}
      <Card className="p-5 border-blue-100 bg-blue-50/40">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-sm text-blue-900">How the Alert System Works</div>
            <div className="mt-2 grid gap-2 text-xs text-blue-800 sm:grid-cols-3">
              <div className="rounded-lg bg-white/80 border border-blue-100 p-3">
                <div className="font-bold text-red-600 mb-1">🔴 RED Alert (Critical)</div>
                <div>Rapid Response Team is automatically notified. <strong>You must acknowledge immediately</strong> and stay with the patient.</div>
              </div>
              <div className="rounded-lg bg-white/80 border border-blue-100 p-3">
                <div className="font-bold text-orange-600 mb-1">🟠 ORANGE Alert (High Risk)</div>
                <div>Duty doctor is notified. <strong>Acknowledge within 15 minutes</strong>, re-check vitals, and await doctor instructions.</div>
              </div>
              <div className="rounded-lg bg-white/80 border border-blue-100 p-3">
                <div className="font-bold text-yellow-600 mb-1">🟡 YELLOW Alert (Watch)</div>
                <div>Increased monitoring needed. <strong>Acknowledge and re-enter vitals</strong> within 1 hour to track trend.</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-blue-700">After clicking <strong>Acknowledge Alert</strong>: your action is logged, the alert status updates to <em>acknowledged</em>, and the relevant doctor or supervisor receives a notification.</p>
          </div>
        </div>
      </Card>

      {/* RAG Clinical Chatbot Panel (Innovation 2) */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <SectionHeader 
            title="AI Patient Clinical Assistant (RAG Chatbot)" 
            hint="Queries only this patient's localized historical database" 
          />
        </div>
        
        {/* Chat History */}
        <div className="mt-4 h-64 overflow-y-auto border border-border rounded-2xl p-4 bg-background/50 space-y-3">
          {chatLog.map((chat, idx) => (
            <div 
              key={idx} 
              className={`flex ${chat.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`max-w-[75%] rounded-2xl p-3 text-sm ${
                  chat.sender === "user" 
                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                    : "bg-white border border-border text-foreground rounded-tl-none shadow-sm"
                }`}
              >
                <div className={`text-[10px] font-semibold mb-1 uppercase tracking-wider ${
                  chat.sender === "user" ? "text-primary-foreground/75" : "text-primary"
                }`}>
                  {chat.sender === "user" ? "You" : "NirikshAmrita AI"}
                </div>
                <p className="leading-relaxed whitespace-pre-line">{chat.text}</p>
              </div>
            </div>
          ))}
          {sendingRag && (
            <div className="flex justify-start">
              <div className="bg-white border border-border text-muted-foreground rounded-2xl rounded-tl-none p-3 text-sm shadow-sm flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleSendRag} className="mt-3 flex gap-2">
          <input 
            type="text" 
            value={query} 
            onChange={e => setQuery(e.target.value)}
            disabled={sendingRag}
            placeholder="Ask a question (e.g. Why was Bed 1204 flagged orange? What is the trend for Blood Glucose?)..." 
            className="w-full rounded-xl border border-input bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button 
            type="submit" 
            disabled={sendingRag || !query.trim()}
            className="rounded-xl bg-primary text-primary-foreground p-3 hover:opacity-95 shadow-elegant disabled:opacity-50 transition"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </Card>
    </div>
  );
}

function TrendCard({ title, keys, colors, chartData }: { title: string; keys: string[]; colors: string[]; chartData: any[] }) {
  return (
    <Card className="p-5">
      <SectionHeader title={title} hint="Recorded Vital Signs Log" />
      <div className="h-56 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            {keys.map((key, i) => (
              <Line 
                key={key}
                type="monotone" 
                dataKey={key} 
                name={key.replace("bp_sys", "Systolic BP").replace("bp_dia", "Diastolic BP").replace("hr", "Heart Rate").replace("spo2", "SpO₂").replace("rr", "Resp Rate").replace("sugar", "Glucose").replace("temp", "Temp")}
                stroke={colors[i]} 
                strokeWidth={2} 
                activeDot={{ r: 6 }} 
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}