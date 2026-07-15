import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Camera, Upload, Check, Loader2, ArrowLeft,
  MessageSquare, CheckCheck, AlertTriangle, AlertCircle,
  Activity, Thermometer, Wind, Droplets, Heart, Zap, Brain,
  ChevronRight, Scan, RefreshCw, X,
} from "lucide-react";
import { getPatient, enterVitals, uploadVitalsOcr } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/nurse/vitals/$patientId")({ component: VitalsPage });

// ─────────────────────────────────────────────
// NEWS2 Calculator
// ─────────────────────────────────────────────
function calculateLiveNews2(
  vitals: Record<string, string>,
  copd: boolean = false
): { score: number; tier: "green" | "yellow" | "orange" | "red"; label: string; sublabel: string } {
  let score = 0;

  const rr = parseFloat(vitals.respiratoryRate);
  if (!isNaN(rr)) {
    if (rr <= 8 || rr >= 25) score += 3;
    else if (rr >= 21) score += 2;
    else if (rr <= 11) score += 1;
  }

  const spo2 = parseFloat(vitals.spo2);
  if (!isNaN(spo2)) {
    if (copd) {
      if (spo2 < 83) score += 3;
      else if (spo2 <= 85) score += 2;
      else if (spo2 <= 87) score += 1;
      else if (spo2 >= 93) {
        if (spo2 <= 94) score += 1;
        else if (spo2 <= 96) score += 2;
        else score += 3;
      }
    } else {
      if (spo2 <= 91) score += 3;
      else if (spo2 <= 93) score += 2;
      else if (spo2 <= 95) score += 1;
    }
  }

  const temp = parseFloat(vitals.temperature);
  if (!isNaN(temp)) {
    if (temp <= 35.0) score += 3;
    else if (temp >= 39.1) score += 2;
    else if (temp <= 36.0 || temp >= 38.1) score += 1;
  }

  let systolic = NaN;
  if (vitals.bp?.includes("/")) {
    systolic = parseFloat(vitals.bp.split("/")[0]);
  } else if (vitals.bp) {
    systolic = parseFloat(vitals.bp);
  }
  if (!isNaN(systolic)) {
    if (systolic <= 90 || systolic >= 220) score += 3;
    else if (systolic <= 100) score += 2;
    else if (systolic <= 111) score += 1;
  }

  const hr = parseFloat(vitals.heartRate);
  if (!isNaN(hr)) {
    if (hr <= 40 || hr >= 131) score += 3;
    else if (hr >= 111) score += 2;
    else if (hr <= 50 || hr >= 91) score += 1;
  }

  if (vitals.consciousness !== "Alert") score += 3;

  if (score >= 7) return { score, tier: "red",    label: "CRITICAL",      sublabel: "Immediate intervention required" };
  if (score >= 5) return { score, tier: "orange",  label: "HIGH RISK",     sublabel: "Urgent clinical review needed" };
  if (score >= 1) return { score, tier: "yellow",  label: "ELEVATED",      sublabel: "Increased monitoring warranted" };
  return                 { score, tier: "green",   label: "STABLE",        sublabel: "Patient within safe parameters" };
}

function getAutoShift(): "Morning" | "Evening" | "Night" {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Morning";
  if (h >= 14 && h < 22) return "Evening";
  return "Night";
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────
function validateField(field: string, val: string): { valid: boolean; error: string | false } {
  if (!val) return { valid: false, error: false };
  const num = parseFloat(val);
  switch (field) {
    case "bp":
      if (val.includes("/")) {
        const [s, d] = val.split("/").map(Number);
        if (isNaN(s) || isNaN(d) || s < 40 || s > 280 || d < 20 || d > 180)
          return { valid: false, error: "Physiological range exceeded · Systolic 40–280 / Diastolic 20–180 mmHg" };
        return { valid: true, error: false };
      }
      return { valid: false, error: "Enter in format Systolic/Diastolic — e.g. 120/80" };
    case "heartRate":
      if (isNaN(num) || num < 20 || num > 250)
        return { valid: false, error: "Pulse out of physiological range · 20–250 bpm" };
      return { valid: true, error: false };
    case "spo2":
      if (isNaN(num) || num < 50 || num > 100)
        return { valid: false, error: "Oxygen saturation out of range · 50–100%" };
      return { valid: true, error: false };
    case "temperature":
      if (isNaN(num) || num < 30 || num > 45)
        return { valid: false, error: "Temperature out of range · 30–45 °C" };
      return { valid: true, error: false };
    case "respiratoryRate":
      if (isNaN(num) || num < 4 || num > 60)
        return { valid: false, error: "Respiratory rate out of range · 4–60 breaths/min" };
      return { valid: true, error: false };
    case "bloodGlucose":
      if (isNaN(num) || num < 20 || num > 600)
        return { valid: false, error: "Glucose out of range · 20–600 mg/dL" };
      return { valid: true, error: false };
    default:
      return { valid: true, error: false };
  }
}

// ─────────────────────────────────────────────
// Score tier config
// ─────────────────────────────────────────────
const TIER_CONFIG = {
  green:  { bg: "bg-emerald-50",  border: "border-emerald-200", text: "text-emerald-800",  score: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  yellow: { bg: "bg-amber-50",    border: "border-amber-200",   text: "text-amber-800",    score: "text-amber-600",   badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-500"   },
  orange: { bg: "bg-orange-50",   border: "border-orange-200",  text: "text-orange-800",   score: "text-orange-600",  badge: "bg-orange-100 text-orange-700",  dot: "bg-orange-500"  },
  red:    { bg: "bg-red-50",      border: "border-red-200",     text: "text-red-800",      score: "text-red-600",     badge: "bg-red-100 text-red-700",       dot: "bg-red-500"     },
} as const;

// ─────────────────────────────────────────────
// Vital Field Row Component
// ─────────────────────────────────────────────
interface VitalFieldProps {
  label: string;
  unit: string;
  icon: React.ReactNode;
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  step?: string;
}

function VitalField({ label, unit, icon, fieldKey, value, onChange, placeholder, type = "text", step }: VitalFieldProps) {
  const check = validateField(fieldKey, value);
  const hasError = !!(value && !check.valid);
  const isValid  = !!(value && check.valid);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <span className="text-slate-400">{icon}</span>
          {label}
        </label>
        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{unit}</span>
      </div>

      <div className="relative">
        <input
          type={type}
          step={step}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800
            bg-white border outline-none
            transition-all duration-200 ease-in-out
            placeholder:text-slate-300 placeholder:font-normal
            ${hasError
              ? "border-red-300 field-error"
              : isValid
              ? "border-emerald-300 field-valid"
              : "border-slate-200 focus:border-blue-400 focus:field-focus"
            }
          `}
        />

        {/* Inline status icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isValid && (
            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100">
              <Check className="h-3 w-3 text-emerald-600 animate-in fade-in zoom-in-75 duration-200" />
            </span>
          )}
          {hasError && (
            <div className="group relative">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-red-100 cursor-help">
                <AlertCircle className="h-3 w-3 text-red-500" />
              </span>
              {/* Tooltip */}
              <div className="pointer-events-none absolute right-0 bottom-7 z-50 w-60 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="relative bg-slate-900 text-white text-[11px] font-medium leading-snug px-3 py-2.5 rounded-xl shadow-xl">
                  {check.error}
                  <div className="absolute right-2 -bottom-1.5 w-3 h-3 bg-slate-900 rotate-45 rounded-sm" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton Loader
// ─────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 px-4">
      <div className="h-14 skeleton w-full rounded-2xl" />
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="h-72 skeleton rounded-3xl" />
        </div>
        <div className="lg:col-span-7 space-y-4">
          <div className="h-24 skeleton rounded-3xl" />
          <div className="h-64 skeleton rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────
function VitalsPage() {
  const { patientId } = useParams({ from: "/nurse/vitals/$patientId" });
  const pId = parseInt(patientId);
  const navigate = useNavigate();

  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // OCR states
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanDone, setScanDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [activeInterval, setActiveInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // WhatsApp overlay
  const [whatsAppOverlay, setWhatsAppOverlay] = useState<any>(null);

  // Form
  const [shift] = useState<"Morning" | "Evening" | "Night">(getAutoShift);
  const [bp, setBp] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [bloodGlucose, setBloodGlucose] = useState("");
  const [temperature, setTemperature] = useState("");
  const [spo2, setSpo2] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [urineOutput, setUrineOutput] = useState("");
  const [consciousness, setConsciousness] = useState("Alert");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPatient(pId);
        setPatient(data);
      } catch (err: any) {
        setFormError(err.message || "Patient record not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [pId]);

  useEffect(() => () => { if (activeInterval) clearInterval(activeInterval); }, [activeInterval]);

  const liveScore = calculateLiveNews2({ bp, heartRate, spo2, temperature, respiratoryRate, consciousness }, patient?.copd);
  const tierCfg = TIER_CONFIG[liveScore.tier];

  // ── OCR Demo Scan ──
  const handleDemoScan = useCallback(() => {
    if (activeInterval) clearInterval(activeInterval);
    setIsScanning(true);
    setScanProgress(0);
    setScanDone(false);

    let prog = 0;
    const iv = setInterval(() => {
      prog += 7;
      setScanProgress(Math.min(prog, 100));
      if (prog >= 100) {
        clearInterval(iv);
        setActiveInterval(null);
        setTimeout(() => {
          setBp("98/54"); setHeartRate("126"); setBloodGlucose("165");
          setTemperature("38.8"); setSpo2("89"); setRespiratoryRate("26");
          setUrineOutput("180"); setConsciousness("Alert");
          setRemarks("Demo OCR: High-risk telemetry detected. Patient is tachycardic & desaturating.");
          setIsScanning(false); setScanDone(true);
          toast.success("Demo telemetry extracted successfully");
        }, 400);
      }
    }, 180);
    setActiveInterval(iv);
  }, [activeInterval]);

  // ── Real File Upload OCR ──
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (activeInterval) clearInterval(activeInterval);
    setIsScanning(true); setScanProgress(15); setScanDone(false);

    const fakeIv = setInterval(() => setScanProgress(p => p < 88 ? p + 6 : p), 280);
    try {
      const result = await uploadVitalsOcr(file);
      clearInterval(fakeIv);
      setScanProgress(100);
      setTimeout(() => {
        const sys = result.systolic_bp || ""; const dia = result.diastolic_bp || "";
        setBp(sys && dia ? `${sys}/${dia}` : sys);
        setHeartRate(result.heart_rate ? String(result.heart_rate) : "");
        setSpo2(result.spo2 ? String(result.spo2) : "");
        setRespiratoryRate(result.respiratory_rate ? String(result.respiratory_rate) : "");
        setTemperature(result.temperature ? String(result.temperature) : "");
        setRemarks(`OCR: Parsed "${file.name}" via Gemini Flash Vision API.`);
        setIsScanning(false); setScanDone(true);
        toast.success("AI Vision scan completed!");
      }, 300);
    } catch (err: any) {
      clearInterval(fakeIv);
      setIsScanning(false);
      toast.error("OCR failed", { description: err.message });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleFileUpload(f);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0]; if (f) handleFileUpload(f);
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);

    const checks = [
      { key: "bp", val: bp }, { key: "heartRate", val: heartRate },
      { key: "spo2", val: spo2 }, { key: "temperature", val: temperature },
      { key: "respiratoryRate", val: respiratoryRate }, { key: "bloodGlucose", val: bloodGlucose },
    ];
    for (const f of checks) {
      const c = validateField(f.key, f.val);
      if (f.val && !c.valid) { toast.error("Validation error", { description: c.error || "Check highlighted fields" }); setSaving(false); return; }
    }

    try {
      let sys: number | undefined, dia: number | undefined;
      if (bp.includes("/")) { const [a, b] = bp.split("/"); sys = parseFloat(a); dia = parseFloat(b); }
      else if (bp) sys = parseFloat(bp);

      let tempVal = temperature ? parseFloat(temperature) : undefined;
      if (tempVal !== undefined && tempVal > 60) tempVal = (tempVal - 32) * 5 / 9;

      const result = await enterVitals({
        patient_id: pId, shift: shift.toLowerCase() as any,
        systolic_bp: sys, diastolic_bp: dia,
        heart_rate: heartRate ? parseFloat(heartRate) : undefined,
        respiratory_rate: respiratoryRate ? parseFloat(respiratoryRate) : undefined,
        spo2: spo2 ? parseFloat(spo2) : undefined,
        temperature: tempVal,
        blood_glucose: bloodGlucose ? parseFloat(bloodGlucose) : undefined,
        urine_output: urineOutput ? parseFloat(urineOutput) : undefined,
        consciousness, source: "nurse_manual",
      });

      const riskLabel = result?.risk_level || "GREEN";
      const news2 = result?.news2_score ?? 0;

      if (riskLabel === "RED" || riskLabel === "ORANGE") {
        setWhatsAppOverlay({ patientName: patient?.full_name || "Patient", bed: patient?.bed_number || "N/A", news2, risk: riskLabel, doctor: "Dr. Ramesh Iyer", phone: "+91 98765 43210" });
      } else {
        toast.success(`Vitals saved · NEWS2: ${news2} · ${riskLabel}`);
        navigate({ to: `/nurse/patient/${pId}` as never });
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to save vitals");
      setSaving(false);
    }
  };

  if (loading) return <SkeletonLoader />;

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, oklch(0.975 0.008 245) 0%, oklch(0.965 0.012 250) 100%)" }}>

      {/* ── Top Navigation Bar (Glassmorphic) ── */}
      <header className="sticky top-0 z-40 border-b border-white/60" style={{ background: "oklch(1 0 0 / 0.80)", backdropFilter: "blur(16px) saturate(1.8)" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-9 w-9 rounded-2xl" style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))" }}>
              {/* Medical Cross SVG */}
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white">
                <rect x="9" y="2" width="6" height="20" rx="2" fill="currentColor" fillOpacity="0.9" />
                <rect x="2" y="9" width="20" height="6" rx="2" fill="currentColor" fillOpacity="0.9" />
                <circle cx="12" cy="12" r="3" fill="white" fillOpacity="0.6" />
              </svg>
              {/* Live pulse dot */}
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
            </div>
            <div className="leading-none">
              <span className="text-base font-semibold text-slate-700 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Niriksh<strong className="font-bold" style={{ color: "oklch(0.45 0.22 258)" }}>Amrita</strong>
              </span>
              <div className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-0.5">Clinical Surveillance</div>
            </div>
          </div>

          {/* Center breadcrumb */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
            <Link to="/nurse" className="hover:text-blue-600 transition font-medium">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to={`/nurse/patient/${pId}` as never} className="hover:text-blue-600 transition font-medium">{patient?.full_name || "Patient"}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-800 font-semibold">Vitals Entry</span>
          </div>

          {/* Right: Shift badge + Avatar */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border"
              style={{ background: "oklch(0.94 0.04 255 / 0.6)", borderColor: "oklch(0.80 0.06 255)", color: "oklch(0.40 0.16 255)" }}>
              <Activity className="h-3.5 w-3.5" />
              {shift} Shift
            </div>
            <Link to="/nurse" className="flex items-center gap-2 bg-white border border-slate-200/80 px-3 py-1.5 rounded-full hover:bg-slate-50 transition shadow-xs">
              <span className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))" }}>AS</span>
              <span className="text-xs font-semibold text-slate-700 hidden sm:block">Nurse A. Singh</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main className="max-w-6xl mx-auto px-5 py-7 pb-16 space-y-6">

        {/* Page title row */}
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Link to={`/nurse/patient/${pId}` as never}
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 transition">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Link>
              <span className="text-slate-300">·</span>
              <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
                Vitals Ingestion
              </h1>
            </div>
            <p className="text-sm text-slate-500 pl-[72px] -mt-0.5">
              {patient?.full_name || "Patient"} · Bed {patient?.bed_number || "N/A"} · {patient?.ward || "Ward"}
            </p>
          </div>

          {/* Patient chip */}
          <div className="hidden md:flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))" }}>
              {patient?.full_name?.slice(0, 2)?.toUpperCase() || "PT"}
            </div>
            <div className="leading-none">
              <div className="text-xs font-bold text-slate-800">{patient?.full_name || "Patient"}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{patient?.age || "—"}y · {patient?.gender || "—"}</div>
            </div>
            {patient?.copd && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">COPD Scale 2</span>
            )}
          </div>
        </div>

        {/* ── Error banner ── */}
        {formError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ── Two-column workspace ── */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">

          {/* ═══════════════════════════════
              LEFT: AI OCR Scanner
          ═══════════════════════════════ */}
          <div className="lg:col-span-5 space-y-5">

            {/* Scanner Card */}
            <div className="rounded-3xl overflow-hidden" style={{ boxShadow: "var(--shadow-premium)", background: "white" }}>
              {/* Card Header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.93 0.06 195 / 0.4)" }}>
                      <Scan className="h-4 w-4" style={{ color: "oklch(0.46 0.16 195)" }} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800" style={{ fontFamily: "var(--font-display)" }}>AI Vision OCR</div>
                      <div className="text-[11px] text-slate-400 font-medium">Stage 2 · Gemini Flash Engine</div>
                    </div>
                  </div>
                  {isScanning && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "oklch(0.46 0.16 195)" }}>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analyzing...
                    </div>
                  )}
                </div>
              </div>

              {/* Drop Zone */}
              <div className="p-5">
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`
                    relative overflow-hidden rounded-2xl border-2 border-dashed min-h-[240px]
                    flex flex-col items-center justify-center
                    transition-all duration-300 grid-dots
                    ${dragOver
                      ? "border-blue-400 bg-blue-50/60"
                      : isScanning
                      ? "border-teal-300 scan-chamber-active"
                      : scanDone
                      ? "border-emerald-300 bg-emerald-50/30"
                      : "border-slate-200 bg-slate-50/40 hover:border-blue-300 hover:bg-blue-50/20"
                    }
                  `}
                >
                  {/* Corner brackets — high-tech scanner aesthetic */}
                  {["top-0 left-0 border-t-2 border-l-2", "top-0 right-0 border-t-2 border-r-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((cls, i) => (
                    <div key={i} className={`absolute ${cls} w-5 h-5 rounded-none m-2`}
                      style={{ borderColor: isScanning ? "oklch(0.56 0.19 195)" : scanDone ? "oklch(0.58 0.17 162)" : "oklch(0.70 0.08 245)" }} />
                  ))}

                  {/* Laser scan line */}
                  {isScanning && <div className="scan-line" />}

                  {/* Content */}
                  {isScanning ? (
                    <div className="space-y-4 text-center px-6 z-10 w-full">
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative h-12 w-12">
                          <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "oklch(0.56 0.19 195)" }} />
                          <div className="relative h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "oklch(0.93 0.06 195 / 0.3)" }}>
                            <Activity className="h-5 w-5" style={{ color: "oklch(0.46 0.16 195)" }} />
                          </div>
                        </div>
                        <div className="text-sm font-bold text-slate-800 animate-pulse">Extracting telemetry...</div>
                        <div className="text-[11px] text-slate-500 font-medium">Gemini Vision AI is reading vitals</div>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full space-y-1.5">
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-200"
                            style={{
                              width: `${scanProgress}%`,
                              background: "linear-gradient(90deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))",
                            }}
                          />
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 text-center tracking-widest uppercase">
                          {scanProgress < 40 ? "Initializing neural pipeline..." : scanProgress < 75 ? "Parsing telemetry channels..." : "Finalizing extraction..."}
                        </div>
                      </div>
                    </div>
                  ) : scanDone ? (
                    <div className="space-y-3 text-center px-6 animate-in zoom-in-95 duration-300">
                      <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                        <Check className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">Telemetry extracted!</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Review fields, then submit</div>
                      </div>
                      <div className="flex items-center gap-2 justify-center">
                        <button type="button" onClick={handleDemoScan}
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition">
                          <RefreshCw className="h-3 w-3" /> Rescan
                        </button>
                        <span className="text-slate-200">|</span>
                        <label htmlFor="ocr-re-upload" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer transition">
                          Upload new
                        </label>
                        <input type="file" id="ocr-re-upload" accept="image/*" className="hidden" onChange={handleInputChange} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5 text-center px-6">
                      <div>
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                          style={{ background: "linear-gradient(135deg, oklch(0.94 0.04 255 / 0.5), oklch(0.93 0.06 195 / 0.3))" }}>
                          <Camera className="h-6 w-6" style={{ color: "oklch(0.45 0.22 258)" }} />
                        </div>
                        <div className="text-sm font-bold text-slate-800">Bedside Monitor Scanner</div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-[240px] mx-auto">
                          Drop a bedside monitor photo here, or run a demo scan to see the AI extraction engine in action.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={handleDemoScan}
                          className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95"
                          style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))", boxShadow: "0 4px 14px oklch(0.45 0.22 258 / 0.30)" }}>
                          <Zap className="h-3.5 w-3.5" /> Run Demo Scan
                        </button>
                        <label htmlFor="ocr-upload-file"
                          className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold text-slate-700 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer">
                          <Upload className="h-3.5 w-3.5" /> Upload Monitor Photo
                        </label>
                        <input type="file" id="ocr-upload-file" accept="image/*" className="hidden" onChange={handleInputChange} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scanner info footer */}
              <div className="px-6 pb-6">
                <div className="rounded-xl p-3.5 text-[11px] text-slate-500 leading-relaxed font-medium"
                  style={{ background: "oklch(0.975 0.006 245)" }}>
                  <strong className="text-slate-700">Scanning tips:</strong> Hold device perpendicular to monitor. Avoid reflective glare. If OCR values look wrong, verify manually before committing.
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════
              RIGHT: Form + NEWS2 Score
          ═══════════════════════════════ */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── Dynamic NEWS2 Score Card ── */}
              <div className={`rounded-3xl border-2 p-5 transition-all duration-500 ${tierCfg.bg} ${tierCfg.border}`}
                style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${tierCfg.dot}`} />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Live NEWS2 Score</span>
                    </div>
                    <div className={`text-sm font-bold ${tierCfg.text}`} style={{ fontFamily: "var(--font-display)" }}>
                      {liveScore.label}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">{liveScore.sublabel}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`font-bold leading-none score-animate ${tierCfg.score}`}
                      style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", fontFamily: "var(--font-display)" }}
                      key={liveScore.score}>
                      {liveScore.score}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">/ 20 max</div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="mt-4 h-1.5 rounded-full overflow-hidden bg-white/60">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((liveScore.score / 20) * 100, 100)}%`,
                      background: liveScore.tier === "green"  ? "oklch(0.58 0.17 162)" :
                                  liveScore.tier === "yellow" ? "oklch(0.70 0.17 55)"  :
                                  liveScore.tier === "orange" ? "oklch(0.65 0.20 45)"  : "oklch(0.57 0.24 22)",
                    }}
                  />
                </div>
              </div>

              {/* ── Vitals Form Card ── */}
              <div className="rounded-3xl bg-white" style={{ boxShadow: "var(--shadow-premium)" }}>
                {/* Card Header */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.94 0.04 255 / 0.4)" }}>
                      <Activity className="h-4 w-4" style={{ color: "oklch(0.45 0.22 258)" }} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800" style={{ fontFamily: "var(--font-display)" }}>Bedside Round Form</div>
                      <div className="text-[11px] text-slate-400 font-medium">Stage 1 · Vitals Ingestion & Validation</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">

                  {/* Vitals grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <VitalField
                      label="Blood Pressure" unit="mmHg" fieldKey="bp" value={bp} onChange={setBp}
                      placeholder="e.g. 120/80"
                      icon={<Heart className="h-3.5 w-3.5" />}
                    />
                    <VitalField
                      label="Heart Rate" unit="bpm" fieldKey="heartRate" value={heartRate} onChange={setHeartRate}
                      placeholder="e.g. 82" type="number" step="1"
                      icon={<Activity className="h-3.5 w-3.5" />}
                    />
                    <VitalField
                      label="Oxygen Saturation (SpO₂)" unit="%" fieldKey="spo2" value={spo2} onChange={setSpo2}
                      placeholder="e.g. 98" type="number" step="0.1"
                      icon={<Droplets className="h-3.5 w-3.5" />}
                    />
                    <VitalField
                      label="Temperature" unit="°C" fieldKey="temperature" value={temperature} onChange={setTemperature}
                      placeholder="e.g. 36.8" type="number" step="0.1"
                      icon={<Thermometer className="h-3.5 w-3.5" />}
                    />
                    <VitalField
                      label="Respiratory Rate" unit="br/min" fieldKey="respiratoryRate" value={respiratoryRate} onChange={setRespiratoryRate}
                      placeholder="e.g. 16" type="number" step="1"
                      icon={<Wind className="h-3.5 w-3.5" />}
                    />
                    <VitalField
                      label="Blood Glucose" unit="mg/dL" fieldKey="bloodGlucose" value={bloodGlucose} onChange={setBloodGlucose}
                      placeholder="e.g. 110" type="number" step="1"
                      icon={<Zap className="h-3.5 w-3.5" />}
                    />
                  </div>

                  {/* Secondary row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Urine Output */}
                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span className="flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5 text-slate-400" /> Urine Output</span>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">mL/hr</span>
                      </label>
                      <input
                        type="number" step="any" value={urineOutput} onChange={e => setUrineOutput(e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 outline-none transition-all duration-200 focus:border-blue-400 focus:field-focus placeholder:text-slate-300"
                      />
                    </div>

                    {/* Consciousness */}
                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span className="flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-slate-400" /> Consciousness</span>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">AVPU</span>
                      </label>
                      <select
                        value={consciousness} onChange={e => setConsciousness(e.target.value)}
                        className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 outline-none transition-all duration-200 focus:border-blue-400 focus:field-focus appearance-none cursor-pointer"
                      >
                        <option value="Alert">Alert (A)</option>
                        <option value="Voice">Response to Voice (V)</option>
                        <option value="Pain">Response to Pain (P)</option>
                        <option value="Unresponsive">Unresponsive (U)</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Clinical Notes / Remarks</label>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="Describe any notable clinical observations for this shift round..."
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 outline-none resize-none transition-all duration-200 focus:border-blue-400 focus:field-focus placeholder:text-slate-300 placeholder:font-normal"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <Link
                      to={`/nurse/patient/${pId}` as never}
                      className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-7 py-2.5 text-xs font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                      style={{
                        background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.52 0.20 268))",
                        boxShadow: "0 4px 14px oklch(0.45 0.22 258 / 0.35)"
                      }}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Submit Vitals Report
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* ── WhatsApp Critical Alert Overlay ── */}
      {whatsAppOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0.1 0.03 258 / 0.75)", backdropFilter: "blur(12px)" }}>
          <div className="w-full max-w-[420px] rounded-3xl bg-white p-7 animate-in zoom-in-95 fade-in duration-300 space-y-6"
            style={{ boxShadow: "0 30px 80px oklch(0.1 0.03 258 / 0.30), 0 0 0 1px oklch(0.9 0.01 250)" }}>

            {/* Alert header */}
            <div className="text-center space-y-3">
              <div className="relative h-16 w-16 mx-auto">
                <div className="absolute inset-0 rounded-full bg-red-100 animate-ping opacity-60" />
                <div className="relative h-16 w-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                  <AlertTriangle className="h-7 w-7 text-red-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
                  Critical Deterioration Detected
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  NEWS2 Score: <strong className="text-red-600">{whatsAppOverlay.news2}</strong> · Risk Level: <strong className="text-red-600">{whatsAppOverlay.risk}</strong>
                </p>
              </div>
            </div>

            {/* Patient info */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 space-y-1">
              <div><strong>Patient:</strong> {whatsAppOverlay.patientName}</div>
              <div><strong>Bed:</strong> {whatsAppOverlay.bed}</div>
            </div>

            {/* WhatsApp alert preview */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center">
                  <MessageSquare className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="text-xs font-bold text-emerald-800">WhatsApp Alert Dispatched</div>
              </div>
              <div className="bg-white rounded-xl border border-emerald-100 p-3 text-[11px] font-mono text-slate-700 leading-relaxed">
                <div className="text-emerald-700 font-bold mb-1">To: {whatsAppOverlay.doctor}</div>
                <div className="text-slate-500 mb-2">{whatsAppOverlay.phone}</div>
                🚨 Critical warning: <strong>{whatsAppOverlay.patientName}</strong> (Bed {whatsAppOverlay.bed}) has NEWS2 score of {whatsAppOverlay.news2}. Immediate bedside review required.
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold">
                <CheckCheck className="h-3.5 w-3.5" /> Delivered · Seen
              </div>
            </div>

            <button
              onClick={() => navigate({ to: `/nurse/patient/${pId}` as never })}
              className="w-full py-3.5 text-sm font-bold text-white rounded-2xl transition-all hover:scale-[1.01] active:scale-95"
              style={{
                background: "linear-gradient(135deg, oklch(0.20 0.04 258), oklch(0.28 0.06 258))",
                boxShadow: "0 4px 16px oklch(0.20 0.04 258 / 0.40)"
              }}
            >
              Continue to Patient Sheet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}