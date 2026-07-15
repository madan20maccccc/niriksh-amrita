import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  Sparkles, Loader2, Send, AlertTriangle, HelpCircle, 
  TrendingUp, Eye, CheckCircle2, Info,
  Smartphone, MessageSquare, CheckCheck, Globe, HelpCircle as HelpIcon, FileText
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
  acknowledgeAlert, getPatientSbars, generateSbarNow
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
  const [sbar, setSbar] = useState<any>(null);
  
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

  // WhatsApp Alert Mockup Panel States
  const [showDoctorPhone, setShowDoctorPhone] = useState(false);

  // SBAR language translation states
  const [sbarLang, setSbarLang] = useState("english");
  const [generatingSbar, setGeneratingSbar] = useState(false);
  const [sbarWarning, setSbarWarning] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [pData, vData, aData, predData, sbarsData] = await Promise.all([
        getPatient(pId),
        getVitalsHistory(pId, 20),
        getAlerts(undefined, pId),
        getPatientPredictions(pId).catch(() => null),
        getPatientSbars(pId).catch(() => [])
      ]);
      
      setPatient(pData);
      setVitalsHistory(vData);
      setAlerts(aData);
      setPredictions(predData);
      if (sbarsData && sbarsData.length > 0) {
        setSbar(sbarsData[0]);
      } else {
        setSbar(null);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load patient records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
      
      const aData = await getAlerts(undefined, pId);
      setAlerts(aData);
      
      toast.success("Alert Acknowledged");
    } catch (err: any) {
      toast.error("Failed to acknowledge alert", {
        description: err.message || "Please try again.",
      });
      setAckingAlertId(null);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    setSbarLang(lang);
    setGeneratingSbar(true);
    setSbarWarning(null);
    try {
      const report = await generateSbarNow(pId, lang);
      if ((report as any).translation_error) {
        setSbarWarning("⚠️ " + (report as any).translation_error);
      } else {
        setSbar(report);
        setSbarWarning(null);
      }
    } catch (err: any) {
      setSbarWarning("⚠️ Translation service busy. Showing English template SBAR.");
    } finally {
      setGeneratingSbar(false);
    }
  };

  const handleRegenerateSbar = async () => {
    setGeneratingSbar(true);
    setSbarWarning(null);
    try {
      const report = await generateSbarNow(pId, sbarLang === "english" ? undefined : sbarLang);
      setSbar(report);
      if (report.generated_by === "template") {
        setSbarWarning("ℹ️ Local rule template used (Gemini API offline).");
      }
    } catch (err: any) {
      toast.error("SBAR Generation Failed", {
        description: "No vitals recorded yet. Please enter vitals first.",
      });
    } finally {
      setGeneratingSbar(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 bg-slate-50/20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Accessing patient record sheet...</p>
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

  const latestVital = vitalsHistory[0] || {};
  const risk = latestVital.risk_level || "LOW";
  const news2 = latestVital.news2_score !== undefined ? latestVital.news2_score : "N/A";

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

  const doctorName = "Dr. Ramesh Iyer";
  const doctorPhone = "+91 98765 43210";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link to="/nurse/patients" className="text-sm text-primary hover:underline font-bold flex items-center gap-1">
        ← Back to assigned patients list
      </Link>

      {/* Patient Profile Card */}
      <Card className="p-6 bg-white/70 backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary-soft text-2xl font-semibold text-primary font-display shadow-sm">
              {patient.full_name[0]}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-bold">PID-{patient.patient_id}</div>
              <h2 className="font-display text-2xl font-bold text-slate-800 leading-tight">{patient.full_name}</h2>
              <div className="mt-1 text-xs text-muted-foreground font-semibold flex items-center gap-2">
                <span>{patient.age}y · {patient.gender === "M" ? "Male" : "Female"}</span>
                <span>·</span>
                <span>Diagnosis: <strong className="text-slate-700">{patient.primary_diagnosis}</strong></span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-bold">Bed {patient.bed_number}</span>
                {patient.diabetes && <span className="bg-orange-50 text-orange-700 border border-orange-200/50 px-2 py-0.5 rounded-lg font-bold">DIABETES</span>}
                {patient.copd && <span className="bg-blue-50 text-blue-700 border border-blue-200/50 px-2 py-0.5 rounded-lg font-bold">COPD</span>}
                {patient.hypertension && <span className="bg-red-50 text-red-700 border border-red-200/50 px-2 py-0.5 rounded-lg font-bold">HYPERTENSION</span>}
                {patient.post_surgery && <span className="bg-purple-50 text-purple-700 border border-purple-200/50 px-2 py-0.5 rounded-lg font-bold">POST-OP</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <StatusPill tone={riskTone(risk.toLowerCase() as any)} className="py-2.5 px-3.5 font-bold shadow-sm">
              {risk} RISK (NEWS2: {news2})
            </StatusPill>
            <Link to={`/nurse/vitals/${patient.id}` as never} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-elegant hover:opacity-95 transition">
              Enter Vitals / OCR
            </Link>
          </div>
        </div>
      </Card>

      {/* WhatsApp Outbound Alert Gate */}
      {(risk === "RED" || risk === "ORANGE") && (
        <Card className="border-pink-200 bg-pink-50/20 p-5 ring-1 ring-pink-100/50 flex flex-col md:flex-row gap-5 items-center justify-between shadow-elegant">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
              <MessageSquare className="h-5.5 w-5.5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-1.5">
                Outbound WhatsApp Escalar Gateway
                <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">WhatsApp Delivered</span>
              </h3>
              <p className="text-xs text-slate-600 max-w-xl leading-relaxed font-medium">
                Hospital warning logic auto-notified the critical care provider <strong>{doctorName} ({doctorPhone})</strong> regarding NEWS2 score deterioration.
              </p>
              <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 pt-1">
                <span>Mode: <strong>Niriksh WhatsApp Agent</strong></span>
                <span className="flex items-center gap-0.5 text-emerald-600">Status: <strong>Delivered</strong> <CheckCheck className="h-3 w-3 text-emerald-500" /></span>
                <span>Stamp: {new Date(latestVital.recorded_at || Date.now()).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowDoctorPhone(!showDoctorPhone)}
            className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 transition flex items-center gap-1.5 shadow-elegant"
          >
            <Smartphone className="h-4 w-4" /> 
            {showDoctorPhone ? "Close Phone Screen" : "Review Doctor's WhatsApp Phone"}
          </button>
        </Card>
      )}

      {/* Mock Doctor Phone Screen Drawer */}
      {showDoctorPhone && (risk === "RED" || risk === "ORANGE") && (
        <div className="flex justify-center py-3 animate-[slideDown_0.25s_ease-out]">
          <div className="w-[330px] rounded-[36px] border-8 border-slate-800 bg-slate-900 shadow-[0_20px_40px_rgba(0,0,0,0.3)] overflow-hidden">
            <div className="h-5 bg-slate-800 w-full flex justify-center items-center">
              <div className="h-3 w-20 bg-slate-900 rounded-b-lg" />
            </div>

            <div className="bg-[#075e54] p-3 text-white flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-[10px]">
                AMR
              </div>
              <div>
                <div className="text-[11px] font-bold">NirikshAmrita Alerting Unit</div>
                <div className="text-[8px] bg-white text-[#075e54] rounded px-1 font-bold inline-block leading-none py-0.5">Verified Business</div>
              </div>
            </div>

            <div className="bg-[#ece5dd] p-3 min-h-[200px] flex flex-col justify-end gap-2">
              <div className="text-[9px] text-center text-slate-500 bg-white/70 rounded-md py-1 max-w-[190px] mx-auto">
                Official patient warning channel.
              </div>

              <div className="bg-[#dcf8c6] rounded-xl p-2.5 text-[11px] text-slate-800 shadow-sm max-w-[90%] self-end">
                <div className="font-bold text-[#075e54] text-[9px] mb-1">⚠️ CLINICAL BREACH FLAG</div>
                <p className="leading-snug font-medium">
                  Patient <strong>{patient.full_name}</strong> (Bed {patient.bed_number}) is deteriorating.
                  <br />
                  - NEWS2 Score: <strong>{news2}</strong>
                  <br />
                  - SpO2: {latestVital.spo2}% | HR: {latestVital.heart_rate} bpm
                  <br />
                  - BP: {Math.round(latestVital.systolic_bp)}/{Math.round(latestVital.diastolic_bp)}
                  <br />
                  Please complete bedside review round.
                </p>
                <div className="text-[8px] text-slate-500 text-right mt-1.5 flex justify-end items-center gap-0.5">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  <CheckCheck className="h-3 w-3 text-emerald-500" />
                </div>
              </div>
            </div>
            
            <div className="h-3 bg-slate-800 w-full flex justify-center items-center">
              <div className="h-1 w-20 bg-slate-600 rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Vital parameters card list */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["BP", latestVital.systolic_bp && latestVital.diastolic_bp ? `${Math.round(latestVital.systolic_bp)}/${Math.round(latestVital.diastolic_bp)}` : "—", "mmHg"],
          ["HR", latestVital.heart_rate ? `${Math.round(latestVital.heart_rate)}` : "—", "bpm"],
          ["SpO₂", latestVital.spo2 ? `${Math.round(latestVital.spo2)}` : "—", "%"],
          ["Temp", latestVital.temperature ? `${latestVital.temperature}` : "—", "°C"],
          ["Glucose", latestVital.blood_glucose ? `${Math.round(latestVital.blood_glucose)}` : "—", "mg/dL"],
          ["Resp Rate", latestVital.respiratory_rate ? `${Math.round(latestVital.respiratory_rate)}` : "—", "/min"],
          ["Conscious", latestVital.consciousness || "Alert", "AVPU"],
          ["Urine", latestVital.urine_output ? `${latestVital.urine_output}` : "—", "ml/shift"],
        ].map(([l, v, u]) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-3 shadow-card flex flex-col justify-between items-center text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{l}</div>
            <div className="mt-1.5 font-display text-lg font-bold text-slate-800">{v}</div>
            <div className="text-[9px] text-muted-foreground font-semibold">{u}</div>
          </div>
        ))}
      </div>

      {/* Regression predictions banner */}
      {predictionCards.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 p-4 ring-1 ring-amber-100/50">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h3 className="font-display text-sm font-bold text-amber-900">AI Vital Deterioration Projections</h3>
              <p className="text-xs text-amber-800 leading-relaxed font-semibold">
                Mathematical trajectory mapping warns that values are approaching safety boundaries:
              </p>
              <ul className="mt-1.5 list-disc list-inside text-xs text-amber-900 space-y-1 font-medium">
                {predictionCards.map((p, i) => (
                  <li key={i}>
                    {p.high && p.high.message}
                    {p.low && p.low.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Line Charts */}
      {chartData.length >= 2 ? (
        <div className="grid gap-6 md:grid-cols-2">
          <TrendCard title="Circulatory System (BP & Pulse)" keys={["bp_sys", "bp_dia", "hr"]} colors={["#ef4444", "#3b82f6", "#10b981"]} chartData={chartData} />
          <TrendCard title="Respiratory (SpO₂ & RR)" keys={["spo2", "rr"]} colors={["#06b6d4", "#f59e0b"]} chartData={chartData} />
        </div>
      ) : (
        <Card className="p-8 text-center text-muted-foreground border-dashed border border-border rounded-2xl">
          Visual graphs will render once subsequent round values are logged.
        </Card>
      )}

      {/* Alert Timeline / Explainability Feed */}
      <Card className="p-5 bg-white/70 backdrop-blur-md">
        <SectionHeader title="Clinical Rules & Warning Logs" hint="Real-time alert status and explainable warnings" />
        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No warning flags active. Wards are stable.
          </div>
        ) : (
          <div className="space-y-3.5 mt-4">
            {alerts.map(a => {
              const isSelected = selectedAlertId === a.id;
              
              return (
                <div key={a.id} className="rounded-xl border border-border bg-white overflow-hidden shadow-sm transition hover:border-slate-300">
                  <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-8 w-8 place-items-center rounded-lg ${
                        a.risk_level === "RED" ? "bg-red-50 text-red-600 border border-red-100" : a.risk_level === "ORANGE" ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-yellow-50 text-yellow-600 border border-yellow-100"
                      }`}>
                        <AlertTriangle className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono font-bold">EWS Warning Alert</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">{a.message}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
                          Logged: {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <StatusPill tone={a.status === "active" ? "critical" : a.status === "acknowledged" ? "warning" : "success"}>
                        {a.status}
                      </StatusPill>
                      <button 
                        onClick={() => handleExplainAlert(a.id)}
                        className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-muted flex items-center gap-1 transition"
                      >
                        <Eye className="h-3.5 w-3.5" /> 
                        {isSelected ? "Hide" : "Explain"}
                      </button>
                    </div>
                  </div>

                  {/* Explainability Dropdown */}
                  {isSelected && (
                    <div className="p-4 border-t border-border bg-slate-50/30 space-y-3.5 animate-[slideDown_0.2s_ease-out]">
                      {loadingExplanation ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Mapping clinical pathways...
                        </div>
                      ) : alertExplanation ? (
                        <div className="space-y-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Warning Logic Check</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">{alertExplanation.rule_name}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Clinical Interpretation</div>
                            <p className="text-xs text-slate-700 mt-0.5 leading-relaxed font-medium">{alertExplanation.rationale}</p>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Rule Parameters Triggers</div>
                            <ul className="mt-1 list-disc list-inside text-xs text-slate-700 space-y-1 font-medium">
                              {alertExplanation.details.map((d: string, idx: number) => (
                                <li key={idx}>{d}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl bg-primary-soft p-3 border border-primary/10">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Required Protocol Action</div>
                            <p className="text-xs text-slate-800 mt-1 font-semibold">{alertExplanation.action_required}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground py-2 text-center">Explanation currently offline.</div>
                      )}
                    </div>
                  )}

                  {/* Acknowledge Form Box */}
                  {a.status === "active" && (
                    <div className="p-3 border-t border-border bg-slate-100/30 flex flex-wrap gap-2 items-center">
                      <input 
                        type="text" 
                        value={ackAction} 
                        onChange={e => setAckAction(e.target.value)} 
                        placeholder="Add round action taken details..." 
                        className="flex-1 rounded-xl border border-input bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                      />
                      <button 
                        onClick={() => handleAckAlert(a.id)}
                        disabled={ackingAlertId === a.id}
                        className="rounded-xl bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        {ackingAlertId === a.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Acknowledge Action
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* SBAR Shift Handover Sheet */}
      <Card className="p-5 bg-white/70 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <FileText className="h-4.5 w-4.5" />
            </span>
            <SectionHeader title="Shift Handover Sheet (SBAR)" hint="AI generated Situation-Background-Assessment-Recommendation notes" />
          </div>
          
          {/* SBAR Translation Toolbar */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-50 p-1">
            <span className="text-[10px] font-bold text-muted-foreground px-2 flex items-center gap-1">
              <Globe className="h-3 w-3" /> LANG:
            </span>
            {[
              { id: "english", label: "EN" },
              { id: "malayalam", label: "മലയാളം (ML)" },
              { id: "telugu", label: "తెలుగు (TE)" }
            ].map(lang => (
              <button
                key={lang.id}
                onClick={() => handleLanguageChange(lang.id)}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                  sbarLang === lang.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {sbarWarning && (
          <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 font-semibold border border-amber-200">
            {sbarWarning}
          </div>
        )}

        {generatingSbar ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-[10px] uppercase font-mono tracking-widest font-bold">Translating handover files...</p>
          </div>
        ) : sbar ? (
          <div className="space-y-3.5">
            {[
              { k: "S", t: "Situation", c: sbar.situation },
              { k: "B", t: "Background", c: sbar.background },
              { k: "A", t: "Assessment", c: sbar.assessment },
              { k: "R", t: "Recommendation", c: sbar.recommendation }
            ].map(b => (
              <div key={b.k} className="rounded-xl border border-border bg-slate-50/50 p-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground font-mono">
                    {b.k}
                  </span>
                  <span className="font-display text-sm font-bold text-slate-800">{b.t}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-700 whitespace-pre-line font-medium">{b.c}</p>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleRegenerateSbar}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition"
              >
                <Sparkles className="h-3.5 w-3.5" /> Regenerate SBAR
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-4">
            <p className="text-xs text-muted-foreground">Handover documentation not available.</p>
            <button
              onClick={handleRegenerateSbar}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-elegant hover:opacity-95 transition flex items-center gap-1.5 mx-auto"
            >
              <Sparkles className="h-3.5 w-3.5" /> Generate SBAR Handover
            </button>
          </div>
        )}
      </Card>

      {/* RAG Clinical Chatbot Panel */}
      <Card className="p-5 bg-white/70 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3 mb-4">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary shadow-sm">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <SectionHeader 
            title="Clinical RAG Assistant Chatbot" 
            hint="Queries only this patient's localized EMR logs and vital charts" 
          />
        </div>
        
        <div className="h-56 overflow-y-auto border border-border rounded-2xl p-4 bg-slate-50/50 space-y-3.5">
          {chatLog.map((chat, idx) => (
            <div 
              key={idx} 
              className={`flex ${chat.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`max-w-[80%] rounded-2xl p-3 text-xs ${
                  chat.sender === "user" 
                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                    : "bg-white border border-border text-slate-800 rounded-tl-none shadow-sm font-medium"
                }`}
              >
                <div className={`text-[9px] font-bold mb-1 uppercase tracking-wider ${
                  chat.sender === "user" ? "text-primary-foreground/75" : "text-primary"
                }`}>
                  {chat.sender === "user" ? "Nurse Query" : "Clinical AI"}
                </div>
                <p className="leading-relaxed whitespace-pre-line">{chat.text}</p>
              </div>
            </div>
          ))}
          {sendingRag && (
            <div className="flex justify-start">
              <div className="bg-white border border-border text-muted-foreground rounded-2xl rounded-tl-none p-3 text-xs shadow-sm flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Analyzing charts...
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSendRag} className="mt-3 flex gap-2">
          <input 
            type="text" 
            value={query} 
            onChange={e => setQuery(e.target.value)}
            disabled={sendingRag}
            placeholder="Ask anything about vitals, alerts, or comorbidities..." 
            className="w-full rounded-xl border border-input bg-white px-3.5 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 font-medium"
          />
          <button 
            type="submit" 
            disabled={sendingRag || !query.trim()}
            className="rounded-xl bg-primary text-primary-foreground p-3 hover:opacity-95 shadow-elegant disabled:opacity-50 transition"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </Card>
      
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function TrendCard({ title, keys, colors, chartData }: { title: string; keys: string[]; colors: string[]; chartData: any[] }) {
  return (
    <Card className="p-4 bg-white/70 backdrop-blur-md">
      <SectionHeader title={title} hint="Rounding Vitals Chart" />
      <div className="h-52 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={10} fontStyle="bold" />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={10} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
            <Legend verticalAlign="top" height={32} iconType="circle" />
            {keys.map((key, i) => (
              <Line 
                key={key}
                type="monotone" 
                dataKey={key} 
                name={key.replace("bp_sys", "Sys BP").replace("bp_dia", "Dia BP").replace("hr", "HR").replace("spo2", "SpO₂").replace("rr", "RR").replace("sugar", "Glucose").replace("temp", "Temp")}
                stroke={colors[i]} 
                strokeWidth={2} 
                activeDot={{ r: 5 }} 
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}