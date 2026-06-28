import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Search, Filter, Pencil, Trash2, ArrowLeftRight, Loader2, RefreshCw, BedDouble } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { getPatients, getWards, getNurses, createPatient, updatePatient, deletePatient } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/patients")({ component: PatientsPage });

function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [wardFilter, setWardFilter] = useState<number | "All">("All");
  const [riskFilter, setRiskFilter] = useState<string>("All");

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, wData, nData] = await Promise.all([getPatients(), getWards(), getNurses()]);
      setPatients(pData);
      setWards(wData);
      setNurses(nData);
    } catch (err: any) {
      setError(err.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = patients.filter(p => {
    const qMatch = p.full_name.toLowerCase().includes(q.toLowerCase()) ||
      p.patient_id.toLowerCase().includes(q.toLowerCase()) ||
      (p.primary_diagnosis || "").toLowerCase().includes(q.toLowerCase());
    const wardMatch = wardFilter === "All" || p.ward_id === wardFilter;
    const riskMatch = riskFilter === "All" || (p.latest_risk_level || "LOW") === riskFilter;
    return qMatch && wardMatch && riskMatch;
  });

  const riskTone = (r: string) => {
    if (r === "RED") return "critical";
    if (r === "ORANGE") return "warning";
    if (r === "YELLOW") return "info";
    return "success";
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading patient registry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20">
        <h3 className="font-display text-xl font-bold">Patient Registry Offline</h3>
        <p className="mt-2 text-sm">{error}</p>
        <button onClick={loadData} className="mt-4 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold">Retry</button>
      </div>
    );
  }

  const criticalCount = patients.filter(p => p.latest_risk_level === "RED").length;
  const activeCount = patients.filter(p => p.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Patient Registry" hint={`${activeCount} active patients · ${criticalCount} critical`} />
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-white hover:bg-muted shadow-sm">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95">
            <Plus className="h-4 w-4" /> Add Patient
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Patients", value: patients.length, tone: "" },
          { label: "Critical (RED)", value: criticalCount, tone: "text-red-600" },
          { label: "High Risk (ORANGE)", value: patients.filter(p => p.latest_risk_level === "ORANGE").length, tone: "text-orange-500" },
          { label: "Stable (GREEN)", value: patients.filter(p => !p.latest_risk_level || p.latest_risk_level === "GREEN").length, tone: "text-green-600" },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</div>
            <div className={`mt-1 font-display text-2xl font-bold ${s.tone || "text-foreground"}`}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-white px-3 py-2 text-sm min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, patient ID, or diagnosis"
              className="w-full bg-transparent outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-input bg-white px-3 py-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={wardFilter}
              onChange={e => setWardFilter(e.target.value === "All" ? "All" : Number(e.target.value))}
              className="bg-transparent outline-none"
            >
              <option value="All">All Wards</option>
              {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-input bg-white px-3 py-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="bg-transparent outline-none">
              <option value="All">All Risk Levels</option>
              <option value="RED">RED - Critical</option>
              <option value="ORANGE">ORANGE - High</option>
              <option value="YELLOW">YELLOW - Watch</option>
              <option value="GREEN">GREEN - Stable</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="max-h-[65vh] overflow-auto">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <BedDouble className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No patients match the selected filters.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/70 backdrop-blur text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Patient</th>
                  <th className="px-5 py-3 text-left">Patient ID</th>
                  <th className="px-5 py-3 text-left">Age / Gender</th>
                  <th className="px-5 py-3 text-left">Diagnosis</th>
                  <th className="px-5 py-3 text-left">Bed</th>
                  <th className="px-5 py-3 text-left">Risk Level</th>
                  <th className="px-5 py-3 text-left">NEWS2</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(p => {
                  const risk = p.latest_risk_level || "GREEN";
                  const wardName = wards.find(w => w.id === p.ward_id)?.name || "—";
                  return (
                    <tr key={p.id} className="hover:bg-primary-soft/20 transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                            {p.full_name[0]}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{p.full_name}</div>
                            <div className="text-xs text-muted-foreground">{wardName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{p.patient_id}</td>
                      <td className="px-5 py-3">{p.age} · {p.gender}</td>
                      <td className="px-5 py-3 max-w-[14rem] truncate text-muted-foreground">{p.primary_diagnosis}</td>
                      <td className="px-5 py-3 font-mono text-xs">{p.bed_number}</td>
                      <td className="px-5 py-3">
                        <StatusPill tone={riskTone(risk) as any}>{risk}</StatusPill>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`font-bold text-sm ${risk === "RED" ? "text-red-600" : risk === "ORANGE" ? "text-orange-500" : "text-foreground"}`}>
                          {p.latest_news2 ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/nurse/patient/${p.id}` as never}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white hover:border-primary/30 hover:bg-primary-soft/50 transition"
                            title="View patient"
                          >
                            <ArrowLeftRight className="h-4 w-4" />
                          </Link>
                          <button 
                            onClick={() => { setSelectedPatient(p); setShowEdit(true); }}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white hover:border-primary/30 hover:bg-primary-soft/50 transition" 
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDischarge(p.id, p.full_name)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white hover:border-red-300 hover:bg-red-50 transition" 
                            title="Discharge"
                          >
                            <Trash2 className="h-4 w-4 text-[var(--color-critical)]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {showAdd && (
        <PatientFormModal
          wards={wards}
          nurses={nurses}
          onClose={() => setShowAdd(false)}
          onSave={loadData}
        />
      )}

      {showEdit && selectedPatient && (
        <PatientFormModal
          patient={selectedPatient}
          wards={wards}
          nurses={nurses}
          onClose={() => {
            setShowEdit(false);
            setSelectedPatient(null);
          }}
          onSave={loadData}
        />
      )}
    </div>
  );

  async function handleDischarge(id: number, name: string) {
    if (!window.confirm(`Are you sure you want to discharge ${name}? This will mark their profile as inactive.`)) {
      return;
    }
    try {
      await deletePatient(id);
      toast.success(`${name} discharged successfully`);
      loadData();
    } catch (err: any) {
      toast.error(`Failed to discharge: ${err.message || "Server issue"}`);
    }
  }
}

// ─────────────────────────────────────────────
// PATIENT FORM MODAL
// ─────────────────────────────────────────────
function PatientFormModal({
  patient,
  wards,
  nurses,
  onClose,
  onSave
}: {
  patient?: any;
  wards: any[];
  nurses: any[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = !!patient;
  const [form, setForm] = useState({
    full_name: patient?.full_name || "",
    age: patient?.age || "",
    gender: patient?.gender || "M",
    bed_number: patient?.bed_number || "",
    ward_id: patient?.ward_id || "",
    assigned_nurse_id: patient?.assigned_nurse_id || "",
    primary_diagnosis: patient?.primary_diagnosis || "",
    allergies: patient?.allergies || "",
    diabetes: patient?.diabetes || false,
    hypertension: patient?.hypertension || false,
    copd: patient?.copd || false,
    post_surgery: patient?.post_surgery || false,
    cardiac_history: patient?.cardiac_history || false,
    comorbidities: (() => {
      const val = patient?.comorbidities;
      if (!val) return [];
      if (typeof val === "object" && Array.isArray(val)) return val;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        if (typeof val === "string") {
          return val.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
        return [];
      }
    })(),
    current_medications: (() => {
      const val = patient?.current_medications;
      if (!val) return [];
      if (typeof val === "object" && Array.isArray(val)) return val;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        if (typeof val === "string") {
          return val.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
        return [];
      }
    })(),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    if (!form.ward_id) {
      setErr("Please select a ward.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...form,
        age: parseInt(form.age as string),
        ward_id: parseInt(form.ward_id as string),
        assigned_nurse_id: form.assigned_nurse_id ? parseInt(form.assigned_nurse_id as string) : null
      };

      if (isEdit) {
        await updatePatient(patient.id, payload);
        toast.success("Patient details updated!");
      } else {
        await createPatient(payload);
        toast.success("Patient registered successfully!");
      }
      onSave();
      onClose();
    } catch (error: any) {
      setErr(error.message || "Failed to save patient records.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-elegant my-8 max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl text-foreground font-bold">{isEdit ? "Edit Patient Details" : "Register New Patient"}</h3>
        <p className="text-sm text-muted-foreground mt-1">Configure admission profile and clinical history.</p>
        
        {err && <div className="mt-3 rounded-xl bg-destructive/10 text-destructive text-xs p-3 border border-destructive/20">{err}</div>}
        
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-foreground">Full Name *</span>
            <input
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Age *</span>
            <input
              type="number"
              value={form.age}
              onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Gender *</span>
            <select
              value={form.gender}
              onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Bed Number *</span>
            <input
              value={form.bed_number}
              onChange={e => setForm(f => ({ ...f, bed_number: e.target.value }))}
              placeholder="e.g. D-04"
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Admission Ward *</span>
            <select
              value={form.ward_id}
              onChange={e => setForm(f => ({ ...f, ward_id: e.target.value }))}
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select Ward...</option>
              {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Assigned Nurse</span>
            <select
              value={form.assigned_nurse_id}
              onChange={e => setForm(f => ({ ...f, assigned_nurse_id: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select Nurse...</option>
              {nurses.filter(n => n.role === "nurse").map(n => (
                <option key={n.id} value={n.id}>{n.full_name} ({n.employee_id})</option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-foreground">Primary Diagnosis *</span>
            <input
              value={form.primary_diagnosis}
              onChange={e => setForm(f => ({ ...f, primary_diagnosis: e.target.value }))}
              placeholder="e.g. COPD exacerbation"
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-foreground">Allergies / Notices</span>
            <input
              value={form.allergies}
              onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
              placeholder="e.g. Penicillin allergy"
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <div className="sm:col-span-2 border-t border-border pt-3 mt-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Clinical History Flags</span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "Diabetes", field: "diabetes" },
                { label: "Hypertension", field: "hypertension" },
                { label: "COPD History", field: "copd" },
                { label: "Post Surgery", field: "post_surgery" },
                { label: "Cardiac History", field: "cardiac_history" }
              ].map(item => (
                <label key={item.field} className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={(form as any)[item.field]}
                    onChange={e => setForm(f => ({ ...f, [item.field]: e.target.checked }))}
                    className="h-4 w-4 rounded accent-primary border-input"
                  />
                  <span className="font-medium">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 border-t border-border pt-4 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium hover:bg-muted">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60 flex items-center gap-1.5"
            >
              {saving ? "Saving..." : isEdit ? "Update Profile" : "Register Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}