import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/section";
import { getPatient, enterVitals } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/nurse/vitals/$patientId")({ component: VitalsPage });

/** Auto-detect clinical shift from current local time:
 *  06:00–13:59 → Morning | 14:00–21:59 → Evening | 22:00–05:59 → Night
 */
function getAutoShift(): "Morning" | "Evening" | "Night" {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Morning";
  if (h >= 14 && h < 22) return "Evening";
  return "Night";
}

function VitalsPage() {
  const { patientId } = useParams({ from: "/nurse/vitals/$patientId" });
  const pId = parseInt(patientId);
  const navigate = useNavigate();

  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states — shift is auto-detected from current time
  const [shift, setShift] = useState<"Morning" | "Evening" | "Night">(getAutoShift);
  const [bp, setBp] = useState(""); // "120/80"
  const [heartRate, setHeartRate] = useState("");
  const [bloodGlucose, setBloodGlucose] = useState("");
  const [temperature, setTemperature] = useState("");
  const [spo2, setSpo2] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [urineOutput, setUrineOutput] = useState("");
  const [consciousness, setConsciousness] = useState("Alert");
  const [remarks, setRemarks] = useState("");

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function loadPatient() {
      try {
        const data = await getPatient(pId);
        setPatient(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to find patient record");
      } finally {
        setLoading(false);
      }
    }
    loadPatient();
  }, [pId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Parse BP
      let systolic_bp: number | undefined;
      let diastolic_bp: number | undefined;
      if (bp.includes("/")) {
        const parts = bp.split("/");
        systolic_bp = parseFloat(parts[0]);
        diastolic_bp = parseFloat(parts[1]);
      } else if (bp) {
        systolic_bp = parseFloat(bp);
      }

      // Convert Fahrenheit to Celsius if inputted as F (e.g. > 60)
      let tempVal = temperature ? parseFloat(temperature) : undefined;
      if (tempVal !== undefined && tempVal > 60) {
        tempVal = (tempVal - 32) * 5 / 9; // F to C
      }

      const vitalData = {
        patient_id: pId,
        shift: shift.toLowerCase() as any,
        systolic_bp,
        diastolic_bp,
        heart_rate: heartRate ? parseFloat(heartRate) : undefined,
        respiratory_rate: respiratoryRate ? parseFloat(respiratoryRate) : undefined,
        spo2: spo2 ? parseFloat(spo2) : undefined,
        temperature: tempVal,
        blood_glucose: bloodGlucose ? parseFloat(bloodGlucose) : undefined,
        urine_output: urineOutput ? parseFloat(urineOutput) : undefined,
        consciousness,
        source: "nurse_manual"
      };

      const result = await enterVitals(vitalData);
      // Show risk-level toast then navigate to patient detail to see updated vitals
      const riskLabel = result?.risk_level || "—";
      const news2 = result?.news2_score ?? "—";
      if (riskLabel === "RED") {
        toast.error(`⚠️ Critical Risk — NEWS2: ${news2}`, { description: "Alert sent to Rapid Response Team. Stay with patient." });
      } else if (riskLabel === "ORANGE") {
        toast.warning(`High Risk — NEWS2: ${news2}`, { description: "Duty doctor notified. Review within 1 hour." });
      } else {
        toast.success(`✅ Vitals saved — NEWS2: ${news2} (${riskLabel})`, { description: `${shift} shift recorded. Scroll down to see updated vitals.` });
      }
      // Navigate to patient detail so nurse can see the saved vitals immediately
      navigate({ to: `/nurse/patient/${pId}` as never });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save vitals record");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading patient details...</p>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20 shadow-card">
        <h3 className="font-display text-xl font-semibold">Error</h3>
        <p className="mt-2 text-sm">{error}</p>
        <Link to="/nurse/patients" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">← Back to Patients</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to={`/nurse/patient/${pId}` as never} className="text-sm text-primary hover:underline font-semibold">
        ← Back to {patient.full_name}
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 mb-4">
          <SectionHeader 
            title={`Record Vitals — ${patient.full_name}`} 
            hint={`Bed ${patient.bed_number} · Diagnosis: ${patient.primary_diagnosis}`} 
          />
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              {(["Morning", "Evening", "Night"] as const).map(t => (
                <button 
                  type="button"
                  key={t} 
                  onClick={() => setShift(t)}
                  className={"rounded-xl px-3 py-2 text-sm font-medium transition " + (shift === t ? "bg-primary text-primary-foreground shadow-elegant" : "border border-border bg-white text-foreground hover:bg-muted")}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Auto-detected: <strong className="text-primary">{getAutoShift()}</strong> shift · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive font-medium border border-destructive/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
          <div className="block text-sm">
            <span className="font-medium text-foreground">Blood pressure</span>
            <input 
              value={bp} 
              onChange={e => setBp(e.target.value)} 
              placeholder="e.g. 120/80" 
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" 
            />
          </div>
          
          <div className="block text-sm">
            <span className="font-medium text-foreground">Heart rate (bpm)</span>
            <input 
              type="number" step="any"
              value={heartRate} 
              onChange={e => setHeartRate(e.target.value)} 
              placeholder="e.g. 88" 
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" 
            />
          </div>

          <div className="block text-sm">
            <span className="font-medium text-foreground">Sugar (mg/dL)</span>
            <input 
              type="number" step="any"
              value={bloodGlucose} 
              onChange={e => setBloodGlucose(e.target.value)} 
              placeholder="e.g. 142" 
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" 
            />
          </div>

          <div className="block text-sm">
            <span className="font-medium text-foreground">Temperature (°F or °C)</span>
            <input 
              type="number" step="any"
              value={temperature} 
              onChange={e => setTemperature(e.target.value)} 
              placeholder="e.g. 98.6 or 37.0" 
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" 
            />
          </div>

          <div className="block text-sm">
            <span className="font-medium text-foreground">SpO₂ (%)</span>
            <input 
              type="number" step="any"
              value={spo2} 
              onChange={e => setSpo2(e.target.value)} 
              placeholder="e.g. 97" 
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" 
            />
          </div>

          <div className="block text-sm">
            <span className="font-medium text-foreground">Respiratory rate (/min)</span>
            <input 
              type="number" step="any"
              value={respiratoryRate} 
              onChange={e => setRespiratoryRate(e.target.value)} 
              placeholder="e.g. 18" 
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" 
            />
          </div>

          <div className="block text-sm">
            <span className="font-medium text-foreground">Urine output (ml)</span>
            <input 
              type="number" step="any"
              value={urineOutput} 
              onChange={e => setUrineOutput(e.target.value)} 
              placeholder="e.g. 800" 
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" 
            />
          </div>

          <div className="block text-sm">
            <span className="font-medium text-foreground">Consciousness</span>
            <select 
              value={consciousness} 
              onChange={e => setConsciousness(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="Alert">Alert</option>
              <option value="Voice">Voice (Drowsy)</option>
              <option value="Pain">Pain (Confused)</option>
              <option value="Unresponsive">Unresponsive</option>
            </select>
          </div>

          <div className="md:col-span-3 block text-sm">
            <span className="font-medium text-foreground">Remarks</span>
            <textarea 
              rows={3} 
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" 
              placeholder="Optional clinical note (remains in patient's log)" 
            />
          </div>
          
          <div className="md:col-span-3 flex justify-end gap-2 border-t border-border pt-4">
            <Link to={`/nurse/patient/${pId}` as never} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium hover:bg-muted">
              Cancel
            </Link>
            <button 
              type="submit" 
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save vitals
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}