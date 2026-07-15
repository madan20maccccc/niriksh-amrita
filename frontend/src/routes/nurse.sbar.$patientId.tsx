import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Printer, Loader2, Languages, Sparkles, AlertTriangle, Info,
  CheckCircle2, FileText, RefreshCw, ChevronRight, Brain,
  Activity, Clock, Globe, ArrowLeft,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { getPatient, getPatientSbars, generateSbarNow } from "@/lib/api";

export const Route = createFileRoute("/nurse/sbar/$patientId")({ component: SbarPage });

const SBAR_BLOCKS = [
  {
    key: "S",
    label: "Situation",
    desc: "Current clinical state requiring attention",
    color: { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-600", text: "text-blue-800" },
  },
  {
    key: "B",
    label: "Background",
    desc: "Relevant medical history & context",
    color: { bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-600", text: "text-indigo-800" },
  },
  {
    key: "A",
    label: "Assessment",
    desc: "Clinical interpretation & risk evaluation",
    color: { bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-600", text: "text-violet-800" },
  },
  {
    key: "R",
    label: "Recommendation",
    desc: "Proposed interventions & escalation actions",
    color: { bg: "bg-teal-50", border: "border-teal-200", badge: "bg-teal-600", text: "text-teal-800" },
  },
];

const LANGUAGES = [
  { id: "english",  label: "English",              flag: "🇬🇧" },
  { id: "hindi",    label: "हिंदी",                flag: "🇮🇳" },
  { id: "tamil",    label: "தமிழ்",               flag: "🇮🇳" },
  { id: "malayalam",label: "മലയാളം",              flag: "🇮🇳" },
  { id: "telugu",   label: "తెలుగు",              flag: "🇮🇳" },
  { id: "kannada",  label: "ಕನ್ನಡ",              flag: "🇮🇳" },
];

function SbarPage() {
  const { patientId } = useParams({ from: "/nurse/sbar/$patientId" });
  const pId = parseInt(patientId);

  const [patient, setPatient] = useState<any>(null);
  const [sbar, setSbar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedLang, setSelectedLang] = useState("english");
  const [error, setError] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const pData = await getPatient(pId);
      setPatient(pData);
      const sbars = await getPatientSbars(pId);
      setSbar(sbars?.[0] ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to load SBAR data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [pId]);

  const handleLanguageChange = async (lang: string) => {
    setSelectedLang(lang);
    if (lang === "english") { setAiWarning(null); return; }
    setGenerating(true); setAiWarning(null);
    try {
      const report = await generateSbarNow(pId, lang);
      if ((report as any).translation_error) setAiWarning("⚠️ " + (report as any).translation_error);
      else { setSbar(report); setAiWarning(null); }
    } catch {
      setAiWarning("⚠️ Translation temporarily unavailable. Showing English.");
    } finally { setGenerating(false); }
  };

  const handleGenerateNow = async () => {
    setGenerating(true); setError(null); setAiWarning(null);
    try {
      const report = await generateSbarNow(pId);
      setSbar(report);
      if (report.generated_by === "template")
        setAiWarning("ℹ️ Generated via clinical rules (Gemini AI unavailable — check API key).");
    } catch {
      setError("No vitals recorded yet. Enter vitals for this patient first, then generate SBAR.");
    } finally { setGenerating(false); }
  };

  if (loading) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "oklch(0.45 0.22 258)" }} />
        <div className="relative h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "oklch(0.94 0.04 255 / 0.5)" }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "oklch(0.45 0.22 258)" }} />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500">Loading handover documents...</p>
    </div>
  );

  const sbarData = sbar ? SBAR_BLOCKS.map(b => ({
    ...b,
    body: b.key === "S" ? sbar.situation : b.key === "B" ? sbar.background : b.key === "A" ? sbar.assessment : sbar.recommendation,
  })) : [];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, oklch(0.975 0.008 245) 0%, oklch(0.965 0.012 250) 100%)" }}>
      <div className="max-w-4xl mx-auto px-5 py-7 pb-16 space-y-6">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to={`/nurse/patient/${pId}` as never}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Patient
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className="text-xs font-semibold text-slate-800">SBAR Handover Note</span>
          </div>
          <button
            onClick={() => window.print()}
            disabled={!sbar}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-40 shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </button>
        </div>

        {/* Main SBAR Card */}
        <div className="rounded-3xl bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-premium)" }}>

          {/* Card Header */}
          <div className="px-7 pt-7 pb-5 border-b border-slate-100">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))" }}>
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
                    Shift Handover Report
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                    <Brain className="h-3 w-3" /> Stage 3 · Gemini Flash AI Synthesis
                    {sbar && (
                      <>
                        <span className="text-slate-200 mx-1">·</span>
                        <Clock className="h-3 w-3" />
                        {new Date(sbar.generated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Language switcher */}
              <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5">
                <span className="text-[10px] font-bold text-slate-400 px-1.5 flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                </span>
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.id}
                    onClick={() => handleLanguageChange(lang.id)}
                    className={`rounded-xl px-2.5 py-1 text-[10px] font-bold transition-all duration-200 ${
                      selectedLang === lang.id
                        ? "text-white shadow-sm"
                        : "text-slate-600 hover:bg-white hover:shadow-sm"
                    }`}
                    style={selectedLang === lang.id
                      ? { background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))" }
                      : {}}
                  >
                    {lang.flag} {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Patient Info Strip */}
          <div className="px-7 py-4 border-b border-slate-100" style={{ background: "oklch(0.975 0.008 245)" }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { k: "Patient Name", v: patient?.full_name || "—" },
                { k: "Age / Gender",  v: `${patient?.age || "—"} yrs · ${patient?.gender === "M" ? "Male" : "Female"}` },
                { k: "Bed",           v: `Bed ${patient?.bed_number || "—"}` },
                { k: "Diagnosis",     v: patient?.primary_diagnosis || "—" },
              ].map(({ k, v }) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k}</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts / Warnings */}
          <div className="px-7">
            {error && (
              <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-medium">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
              </div>
            )}
            {aiWarning && (
              <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 font-medium">
                <Info className="h-4 w-4 mt-0.5 shrink-0" /> {aiWarning}
              </div>
            )}
          </div>

          {/* SBAR Blocks */}
          <div className="px-7 py-6 space-y-4">
            {generating ? (
              <div className="flex flex-col items-center justify-center h-52 gap-4">
                <div className="relative h-14 w-14">
                  <div className="absolute inset-0 rounded-full animate-spin"
                    style={{ background: "conic-gradient(from 0deg, oklch(0.45 0.22 258), transparent)" }} />
                  <div className="absolute inset-1 rounded-full bg-white flex items-center justify-center">
                    <Brain className="h-5 w-5" style={{ color: "oklch(0.45 0.22 258)" }} />
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  {selectedLang !== "english" ? `Translating to ${LANGUAGES.find(l => l.id === selectedLang)?.label}...` : "Generating clinical summary..."}
                </div>
                <div className="text-xs text-slate-400">Gemini Flash is analyzing vital trends</div>
              </div>
            ) : sbar ? (
              <>
                {sbarData.map(b => (
                  <div key={b.key} className={`rounded-2xl border ${b.color.border} ${b.color.bg} p-5`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-base ${b.color.badge}`}
                        style={{ fontFamily: "var(--font-display)" }}>
                        {b.key}
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${b.color.text}`} style={{ fontFamily: "var(--font-display)" }}>{b.label}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{b.desc}</div>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line pl-12">{b.body}</p>
                  </div>
                ))}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                    <Sparkles className="h-3.5 w-3.5" style={{ color: "oklch(0.45 0.22 258)" }} />
                    Generated by: <span className="font-semibold text-slate-600">{sbar.generated_by}</span>
                  </div>
                  <button
                    onClick={handleGenerateNow}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.52 0.20 268))" }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate SBAR
                  </button>
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="py-16 text-center space-y-5">
                <div className="h-16 w-16 rounded-3xl flex items-center justify-center mx-auto"
                  style={{ background: "linear-gradient(135deg, oklch(0.94 0.04 255 / 0.5), oklch(0.93 0.06 195 / 0.3))" }}>
                  <FileText className="h-7 w-7" style={{ color: "oklch(0.45 0.22 258)" }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800" style={{ fontFamily: "var(--font-display)" }}>No SBAR report yet</h3>
                  <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    No shift handover report has been generated. Submit vitals for this patient to trigger AI analysis.
                  </p>
                </div>
                <button
                  onClick={handleGenerateNow}
                  disabled={generating}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-2xl mx-auto transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))",
                    boxShadow: "0 4px 14px oklch(0.45 0.22 258 / 0.35)"
                  }}
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate SBAR Summary
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Comorbidity tags if any */}
        {patient && (patient.copd || patient.diabetes || patient.hypertension || patient.cardiac_history) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-2 items-center shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Comorbidities:</span>
            {patient.copd && <Tag label="COPD — Scale 2 SpO₂" color="amber" />}
            {patient.diabetes && <Tag label="Diabetes" color="orange" />}
            {patient.hypertension && <Tag label="Hypertension" color="red" />}
            {patient.cardiac_history && <Tag label="Cardiac History" color="purple" />}
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  const map: Record<string, string> = {
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    purple: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${map[color] ?? map.amber}`}>{label}</span>
  );
}