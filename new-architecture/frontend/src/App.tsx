import { useState, useEffect } from "react";
import { 
  Camera, Upload, Check, Loader2, 
  Settings, MessageSquare, CheckCheck, AlertTriangle, AlertCircle
} from "lucide-react";

// Standard NEWS2 calculator helper for on-the-fly UI updates
function calculateLiveNews2(vitals: any, copd: boolean = false): { score: number; color: string; label: string; bgClass: string } {
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

  // Parse blood pressure
  let systolic = NaN;
  if (vitals.bp && vitals.bp.includes("/")) {
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

  if (vitals.consciousness !== "Alert") {
    score += 3;
  }

  // Get color and label
  if (score >= 7) return { score, color: "border-red-500 text-red-700", bgClass: "bg-red-50/70 shadow-red-500/10", label: "CRITICAL ALERT (RED)" };
  if (score >= 5) return { score, color: "border-orange-500 text-orange-700", bgClass: "bg-orange-50/70 shadow-orange-500/10", label: "ELEVATED RISK (ORANGE)" };
  if (score >= 1) return { score, color: "border-yellow-500 text-yellow-700", bgClass: "bg-yellow-50/70 shadow-yellow-500/10", label: "WATCH STANDING (YELLOW)" };
  return { score, color: "border-emerald-500 text-emerald-700", bgClass: "bg-emerald-50/50 shadow-emerald-500/5", label: "STABLE CONDITION (GREEN)" };
}

function getAutoShift(): "Morning" | "Evening" | "Night" {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Morning";
  if (h >= 14 && h < 22) return "Evening";
  return "Night";
}

function App() {
  // Layout & Entry states
  const [entryMode, setEntryMode] = useState<"ocr" | "manual">("ocr");
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResultReady, setScanResultReady] = useState(false);
  const [activeInterval, setActiveInterval] = useState<any>(null);
  const [whatsAppOverlay, setWhatsAppOverlay] = useState<any>(null);
  const [shift, setShift] = useState<"Morning" | "Evening" | "Night">(getAutoShift);

  // Form states
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
    return () => {
      if (activeInterval) clearInterval(activeInterval);
    };
  }, [activeInterval]);

  // Real-time validation checks for form inputs
  const validateField = (field: string, val: string) => {
    if (!val) return { valid: false, error: false };
    const num = parseFloat(val);
    switch (field) {
      case "bp":
        if (val.includes("/")) {
          const parts = val.split("/");
          const s = parseFloat(parts[0]);
          const d = parseFloat(parts[1]);
          if (isNaN(s) || isNaN(d) || s < 40 || s > 280 || d < 20 || d > 180) {
            return { valid: false, error: "Physiological limits exceeded (Systolic 40-280 / Diastolic 20-180)" };
          }
          return { valid: true, error: false };
        }
        return { valid: false, error: "Format must be Systolic/Diastolic (e.g. 120/80)" };
      case "heartRate":
        if (isNaN(num) || num < 20 || num > 250) {
          return { valid: false, error: "Pulse out of range (20 - 250 bpm)" };
        }
        return { valid: true, error: false };
      case "spo2":
        if (isNaN(num) || num < 50 || num > 100) {
          return { valid: false, error: "Oxygen levels out of range (50% - 100%)" };
        }
        return { valid: true, error: false };
      case "temperature":
        if (isNaN(num) || num < 30 || num > 45) {
          return { valid: false, error: "Temp out of range (30°C - 45°C)" };
        }
        return { valid: true, error: false };
      case "respiratoryRate":
        if (isNaN(num) || num < 4 || num > 60) {
          return { valid: false, error: "Rate out of range (4 - 60 breaths/min)" };
        }
        return { valid: true, error: false };
      case "bloodGlucose":
        if (isNaN(num) || num < 20 || num > 600) {
          return { valid: false, error: "Glucose limits exceeded (20 - 600 mg/dL)" };
        }
        return { valid: true, error: false };
      case "urineOutput":
        if (isNaN(num) || num < 0 || num > 3000) {
          return { valid: false, error: "Urine output out of range (0 - 3000 ml)" };
        }
        return { valid: true, error: false };
      default:
        return { valid: true, error: false };
    }
  };

  const getLiveScore = () => {
    return calculateLiveNews2({
      bp, heartRate, spo2, temperature, respiratoryRate, consciousness
    }, false); // Assume false for standard presentation
  };

  // Demo Scan Simulation
  const handleOcrDemoScan = () => {
    if (activeInterval) clearInterval(activeInterval);

    setIsScanning(true);
    setScanProgress(0);
    setScanResultReady(false);

    let progressVal = 0;
    const interval = setInterval(() => {
      progressVal += 10;
      setScanProgress(progressVal);

      if (progressVal >= 100) {
        clearInterval(interval);
        setActiveInterval(null);
        
        setTimeout(() => {
          setBp("98/54");
          setHeartRate("126");
          setBloodGlucose("165");
          setTemperature("38.8");
          setSpo2("89");
          setRespiratoryRate("26");
          setUrineOutput("180");
          setConsciousness("Alert");
          setRemarks("OCR Scan: High-risk telemetry detected. Patient is tachycardic & desaturating.");
          
          setIsScanning(false);
          setScanResultReady(true);
        }, 300);
      }
    }, 150);

    setActiveInterval(interval);
  };

  // Real Image Upload via Gemini Flash OCR
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanProgress(15);
    setScanResultReady(false);

    const fakeProgress = setInterval(() => {
      setScanProgress((prev) => (prev < 90 ? prev + 8 : prev));
    }, 300);

    try {
      // Connect to local FastAPI OCR endpoint
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://127.0.0.1:8000/vitals/ocr", {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("OCR parsing failed on backend.");

      const result = await res.json();
      clearInterval(fakeProgress);
      setScanProgress(100);

      setTimeout(() => {
        if (result.systolic_bp || result.diastolic_bp) {
          const sys = result.systolic_bp || "";
          const dia = result.diastolic_bp || "";
          setBp(sys && dia ? `${sys}/${dia}` : sys ? `${sys}` : "");
        } else {
          setBp("");
        }

        setHeartRate(result.heart_rate ? String(result.heart_rate) : "");
        setSpo2(result.spo2 ? String(result.spo2) : "");
        setRespiratoryRate(result.respiratory_rate ? String(result.respiratory_rate) : "");
        setTemperature(result.temperature ? String(result.temperature) : "");
        setRemarks(`OCR Scan: Successfully parsed monitor photo "${file.name}" using Gemini Flash Vision.`);
        
        setIsScanning(false);
        setScanResultReady(true);
      }, 300);
    } catch (err: any) {
      clearInterval(fakeProgress);
      setIsScanning(false);
      alert("OCR Image Parse Failed. Please make sure your FastAPI backend is running on port 8000.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const scoreData = getLiveScore();

    // Trigger visual WhatsApp popups for red/orange alarms
    if (scoreData.score >= 5) {
      setWhatsAppOverlay({
        patientName: "Ananya Sharma",
        bed: "102",
        news2: scoreData.score,
        risk: scoreData.score >= 7 ? "RED" : "ORANGE",
        doctor: "Dr. Ramesh Iyer",
        phone: "+91 98765 43210"
      });
      setSaving(false);
    } else {
      alert(`Vitals submitted successfully! (NEWS2: ${scoreData.score})`);
      setSaving(false);
    }
  };

  const liveScoreData = getLiveScore();

  const renderFieldWithValidation = (label: string, fieldKey: string, val: string, inputElement: React.ReactNode) => {
    const check = validateField(fieldKey, val);
    const hasError = val && !check.valid;
    const isValid = val && check.valid;

    return (
      <div className="block text-sm space-y-1.5 relative">
        <span className="font-semibold text-slate-700 flex items-center justify-between">
          {label}
          {isValid && <Check className="h-4 w-4 text-emerald-500 animate-in fade-in" />}
          {hasError && (
            <div className="group relative cursor-pointer">
              <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
              <div className="absolute right-0 bottom-6 bg-red-600 text-white text-[10px] p-2 rounded-xl shadow-lg w-52 z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {check.error}
              </div>
            </div>
          )}
        </span>
        <div className={`relative transition-all duration-200 rounded-xl ${
          hasError ? "ring-2 ring-red-500/50 shadow-md" : isValid ? "ring-2 ring-emerald-500/30" : "focus-within:ring-2 focus-within:ring-pink-500/20"
        }`}>
          {inputElement}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      
      {/* Sticky Glassmorphic Header */}
      <header className="bg-white/80 border-b border-pink-100/50 py-4 px-6 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-500 flex items-center justify-center text-white shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-slate-800">
                Niriksh<span className="text-pink-600 font-black">Amrita</span>
              </h1>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold font-mono">Agentic Clinical Early Warning Surveillance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-pink-100/50 px-3.5 py-1.5 rounded-full border border-pink-200/30 text-xs font-bold text-pink-700">
              Shift: <span className="font-extrabold">{shift} Round</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200/50 p-1 rounded-full">
              <span className="h-6 w-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-[10px] font-bold">AS</span>
              <span className="text-[11px] font-bold text-slate-600 pr-2">Nurse A. Singh</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6">
        
        {/* Navigation Simulator tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-200/50 p-1 rounded-2xl border border-slate-200/30">
          <button
            type="button"
            onClick={() => setEntryMode("ocr")}
            className={`flex items-center justify-center gap-2 py-3 text-xs font-extrabold rounded-xl transition-all duration-200 ${
              entryMode === "ocr" 
                ? "bg-white text-pink-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-850 hover:bg-white/40"
            }`}
          >
            <Camera className="h-4 w-4" /> Ingest Vitals (AI OCR)
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("manual")}
            className={`flex items-center justify-center gap-2 py-3 text-xs font-extrabold rounded-xl transition-all duration-200 ${
              entryMode === "manual" 
                ? "bg-white text-pink-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <Settings className="h-4 w-4" /> Manual Entry Form
          </button>
        </div>

        {/* 2-Column Grid */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Vision Scanner chamber */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-5 bg-white border border-pink-100/30 shadow-premium rounded-3xl relative overflow-hidden">
              <h3 className="text-sm font-extrabold text-slate-800 mb-3.5 flex items-center gap-1.5">
                <Camera className="text-pink-500 h-4.5 w-4.5" /> AI Vision OCR scanner
              </h3>
              
              <div className="border-2 border-dashed border-pink-200 bg-pink-50/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden min-h-[220px]">
                {isScanning ? (
                  <div className="space-y-4 w-full px-4 z-20">
                    <div className="scan-line"></div>
                    <div className="h-8 w-8 rounded-full border-4 border-pink-500 border-t-transparent animate-spin mx-auto"></div>
                    <div className="text-xs font-bold text-slate-700 animate-pulse">Extracting Telemetry Digital Layout...</div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-pink-500 h-full transition-all duration-200" style={{ width: `${scanProgress}%` }} />
                    </div>
                  </div>
                ) : scanResultReady ? (
                  <div className="space-y-3 animate-in zoom-in-95">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <Check className="h-5 w-5" />
                    </div>
                    <div className="text-xs font-extrabold text-slate-800">Telemetry Ingest Completed!</div>
                    <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-normal">Vitals populated in the workspace card. Verify and hit submit to commit.</p>
                    <div className="flex gap-2 justify-center pt-1 text-[10px] font-bold">
                      <button type="button" onClick={handleOcrDemoScan} className="text-pink-600 hover:underline">Scan Again</button>
                      <span className="text-slate-300">|</span>
                      <label htmlFor="ocr-upload-again" className="text-pink-600 hover:underline cursor-pointer">Upload Photo</label>
                      <input type="file" id="ocr-upload-again" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="h-10 w-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center mx-auto">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-800">Bedside vital screen camera scan</div>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">Capture bedside telemetry screen or trigger presentation demo scanning to analyze vitals.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button 
                        type="button" 
                        onClick={handleOcrDemoScan}
                        className="bg-pink-600 hover:bg-pink-700 text-white text-[10px] font-bold px-3 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1"
                      >
                        Run Demo Scan
                      </button>
                      <input type="file" id="ocr-upload-file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                      <label 
                        htmlFor="ocr-upload-file"
                        className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-3 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload Photo
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 mt-5 pt-4 space-y-2">
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Rounding Guidelines</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Ensure the camera is aligned perpendicular to the monitor. Avoid capture glares. If validation flags are active, double check manually.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Vitals Form ledger */}
          <div className="lg:col-span-7 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="p-6 bg-white border border-pink-100/30 shadow-premium rounded-3xl space-y-6 relative">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800">Bedside Round Ingestion Form</h2>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Vitals ledger for Ananya Sharma · Bed 102</p>
                  </div>
                </div>

                {/* Dynamic NEWS2 Calculator widget */}
                <div className={`border p-4 rounded-2xl transition-all duration-300 flex items-center justify-between shadow-sm ${liveScoreData.bgClass} ${liveScoreData.color}`}>
                  <div className="space-y-0.5">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider">Dynamic Early Warning Score</h4>
                    <div className="text-[11px] font-bold flex items-center gap-1.5">
                      Classification: <span className="underline">{liveScoreData.label}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-extrabold font-display leading-none">{liveScoreData.score}</div>
                    <div className="text-[8px] uppercase tracking-wider font-bold text-slate-400 mt-1">NEWS2 Metric</div>
                  </div>
                </div>

                {/* Form Grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  
                  {renderFieldWithValidation(
                    "Blood Pressure (systolic/diastolic)",
                    "bp",
                    bp,
                    <input 
                      value={bp} 
                      onChange={e => setBp(e.target.value)} 
                      placeholder="e.g. 120/80" 
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none font-bold text-slate-800 text-xs transition focus:border-pink-300" 
                    />
                  )}

                  {renderFieldWithValidation(
                    "Heart Rate (bpm)",
                    "heartRate",
                    heartRate,
                    <input 
                      type="number" step="any"
                      value={heartRate} 
                      onChange={e => setHeartRate(e.target.value)} 
                      placeholder="e.g. 82" 
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none font-bold text-slate-800 text-xs transition focus:border-pink-300" 
                    />
                  )}

                  {renderFieldWithValidation(
                    "Oxygen Saturation (SpO₂ %)",
                    "spo2",
                    spo2,
                    <input 
                      type="number" step="any"
                      value={spo2} 
                      onChange={e => setSpo2(e.target.value)} 
                      placeholder="e.g. 98" 
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none font-bold text-slate-800 text-xs transition focus:border-pink-300" 
                    />
                  )}

                  {renderFieldWithValidation(
                    "Temperature (°C)",
                    "temperature",
                    temperature,
                    <input 
                      type="number" step="any"
                      value={temperature} 
                      onChange={e => setTemperature(e.target.value)} 
                      placeholder="e.g. 36.8" 
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none font-bold text-slate-800 text-xs transition focus:border-pink-300" 
                    />
                  )}

                  {renderFieldWithValidation(
                    "Respiratory Rate (breaths/min)",
                    "respiratoryRate",
                    respiratoryRate,
                    <input 
                      type="number" step="any"
                      value={respiratoryRate} 
                      onChange={e => setRespiratoryRate(e.target.value)} 
                      placeholder="e.g. 16" 
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none font-bold text-slate-800 text-xs transition focus:border-pink-300" 
                    />
                  )}

                  {renderFieldWithValidation(
                    "Blood Glucose (sugar mg/dL)",
                    "bloodGlucose",
                    bloodGlucose,
                    <input 
                      type="number" step="any"
                      value={bloodGlucose} 
                      onChange={e => setBloodGlucose(e.target.value)} 
                      placeholder="e.g. 110" 
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none font-bold text-slate-800 text-xs transition focus:border-pink-300" 
                    />
                  )}

                  <div className="block text-sm space-y-1.5 col-span-2">
                    <span className="font-semibold text-slate-700">Consciousness Level</span>
                    <select 
                      value={consciousness} 
                      onChange={e => setConsciousness(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none font-bold text-slate-800 text-xs transition focus:border-pink-300"
                    >
                      <option value="Alert">Alert (AVPU - A)</option>
                      <option value="Voice">Voice/Drowsy (AVPU - V)</option>
                      <option value="Pain">Pain/Confused (AVPU - P)</option>
                      <option value="Unresponsive">Unresponsive (AVPU - U)</option>
                    </select>
                  </div>

                  {renderFieldWithValidation(
                    "Urine Output (ml/shift)",
                    "urineOutput",
                    urineOutput,
                    <input 
                      type="number" step="any"
                      value={urineOutput} 
                      onChange={e => setUrineOutput(e.target.value)} 
                      placeholder="e.g. 300" 
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none font-bold text-slate-800 text-xs transition focus:border-pink-300" 
                    />
                  )}

                  {/* Add Shift Round selection controls */}
                  <div className="block text-sm space-y-1.5">
                    <span className="font-semibold text-slate-700">Rounds Selection</span>
                    <div className="flex gap-1">
                      {(["Morning", "Evening", "Night"] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setShift(t)}
                          className={`flex-1 py-2 text-[10px] font-bold border rounded-xl transition ${
                            shift === t 
                              ? "bg-pink-100 border-pink-300 text-pink-700 font-extrabold" 
                              : "border-slate-200 hover:bg-slate-50 text-slate-500"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                <div className="block text-sm space-y-1.5">
                  <span className="font-semibold text-slate-700">Rounding Remarks / Notes</span>
                  <textarea 
                    rows={2} 
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none text-xs transition focus:border-pink-300" 
                    placeholder="Provide clinical notes or specific context regarding the round..." 
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="rounded-xl bg-pink-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-pink-700 disabled:opacity-50 flex items-center gap-1.5 transition"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Submit Vitals Report
                  </button>
                </div>

              </div>
            </form>
          </div>

        </div>

      </main>

      {/* WhatsApp Outbound Overlay popup */}
      {whatsAppOverlay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-pink-200 bg-white p-6 shadow-premium text-center space-y-5">
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto animate-bounce">
              <AlertTriangle className="h-6 w-6" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold text-slate-800">
                🚨 NEWS2 score: {whatsAppOverlay.news2} ({whatsAppOverlay.risk} Risk)
              </h3>
              <p className="text-xs text-slate-400 font-semibold">
                Critical clinical deterioration detected for <strong>{whatsAppOverlay.patientName}</strong> (Bed {whatsAppOverlay.bed}).
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 space-y-3 text-left">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                <div className="text-xs font-bold text-emerald-800">Automated WhatsApp Alert Dispatched</div>
              </div>
              <div className="text-[10px] font-mono text-slate-700 leading-relaxed bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm">
                <strong>To:</strong> {whatsAppOverlay.doctor} ({whatsAppOverlay.phone})
                <br />
                <strong>Msg:</strong> Critical warning! Patient {whatsAppOverlay.patientName} (Bed {whatsAppOverlay.bed}) has NEWS2 score of {whatsAppOverlay.news2}. Review bedside immediately.
              </div>
              <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold justify-end">
                <CheckCheck className="h-3.5 w-3.5" /> Sent & Delivered
              </div>
            </div>

            <button
              onClick={() => setWhatsAppOverlay(null)}
              className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3.5 transition flex items-center justify-center gap-2 shadow-md"
            >
              Close Alert Dialog
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
