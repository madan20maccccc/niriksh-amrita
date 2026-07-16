import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Eye, Hospital, Loader2, Save, X, Phone, Key } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { getWards, getPatients, getNurses, createWard, updateWard, deleteWard } from "@/lib/api";
import { toast } from "sonner";

type WardSearch = {
  wardId?: number;
};

export const Route = createFileRoute("/admin/wards")({
  validateSearch: (search: Record<string, unknown>): WardSearch => {
    return {
      wardId: search.wardId ? Number(search.wardId) : undefined,
    };
  },
  component: WardsPage,
});

function WardsPage() {
  const search = Route.useSearch();
  const [wards, setWards] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedWardId, setSelectedWardId] = useState<number | null>(null);
  
  // Modals state
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [activeWard, setActiveWard] = useState<any>(null);

  useEffect(() => {
    if (search.wardId) {
      setSelectedWardId(search.wardId);
    }
  }, [search.wardId]);

  const loadData = async () => {
    try {
      const [wData, pData, nData] = await Promise.all([
        getWards(),
        getPatients(),
        getNurses()
      ]);
      setWards(wData);
      setPatients(pData);
      setNurses(nData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load ward analytics database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteWard = async (wardId: number, wardName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${wardName} Ward?`)) return;
    try {
      await deleteWard(wardId);
      toast.success(`${wardName} Ward deleted successfully.`);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete ward.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Syncing ward telemetry registers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20 shadow-card">
        <h3 className="font-display text-xl font-bold">Wards System Offline</h3>
        <p className="mt-2 text-sm">{error}</p>
        <button onClick={() => { setLoading(true); loadData(); }} className="mt-4 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold">
          Retry Sync
        </button>
      </div>
    );
  }

  const selectedWard = selectedWardId ? wards.find(w => w.id === selectedWardId) : null;

  if (selectedWard) {
    const wp = patients.filter(p => p.ward_id === selectedWard.id);
    const wn = nurses.filter(n => n.department === selectedWard.name);
    
    // Determine ward status
    const criticalCount = wp.filter(p => p.latest_risk_level === "RED").length;
    const warningCount = wp.filter(p => p.latest_risk_level === "ORANGE").length;
    
    const status = criticalCount > 1 ? "Critical" : (criticalCount > 0 || warningCount > 1) ? "Strained" : "Operational";
    const tone = criticalCount > 1 ? "critical" : (criticalCount > 0 || warningCount > 1) ? "warning" : "success";
    
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedWardId(null)} className="text-sm text-primary hover:underline font-semibold">
          ← Back to wards overview
        </button>
        
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Hospital className="h-6 w-6" />
              </span>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">WARD-0{selectedWard.id}</div>
                <h2 className="font-display text-2xl font-bold text-foreground">{selectedWard.name} Ward</h2>
              </div>
            </div>
            <StatusPill tone={tone}>{status}</StatusPill>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Total Bed Capacity" value={selectedWard.capacity || 20} />
            <Mini label="Beds Occupied" value={`${wp.length}/${selectedWard.capacity || 20}`} />
            <Mini label="Active Patients" value={wp.length} />
            <Mini label="Nurses Stationed" value={wn.length} />
          </div>

          {/* Doctor phone display */}
          {(selectedWard.doctor_phone || selectedWard.callmebot_key) && (
            <div className="mt-5 border-t border-slate-100 pt-4 flex flex-wrap gap-6 text-xs text-slate-500 font-medium">
              {selectedWard.doctor_phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>Ward Doctor Phone: <strong className="text-slate-800 font-bold">+{selectedWard.doctor_phone}</strong></span>
                </div>
              )}
              {selectedWard.callmebot_key && (
                <div className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-slate-400" />
                  <span>CallMeBot API Key: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">configured ✓</span></span>
                </div>
              )}
            </div>
          )}
        </Card>
        
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Nurses Card */}
          <Card className="p-5">
            <SectionHeader title="Stationed Nurses" hint="Assigned to this ward" />
            <div className="mt-4">
              {wn.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                  No nurses currently clocked in this ward.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {wn.map(n => (
                    <li key={n.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{n.full_name}</div>
                        <div className="text-xs text-muted-foreground">{n.employee_id} · {n.department || "General"}</div>
                      </div>
                      <StatusPill tone={n.is_active ? "success" : "muted"}>
                        {n.is_active ? "On Duty" : "Off Duty"}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Patients Card */}
          <Card className="p-5">
            <SectionHeader title="Surrendered Patients" hint="Beds occupancy list" />
            <div className="mt-4">
              {wp.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                  All beds are currently vacant in this ward.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {wp.map(p => {
                    const r = p.latest_risk_level || "LOW";
                    return (
                      <li key={p.id} className="flex items-center justify-between py-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{p.full_name}</div>
                          <div className="text-xs text-muted-foreground">Bed {p.bed_number} · Diagnosis: {p.primary_diagnosis}</div>
                        </div>
                        <StatusPill tone={r === "RED" ? "critical" : r === "ORANGE" ? "warning" : r === "YELLOW" ? "info" : "success"}>
                          {r} RISK
                        </StatusPill>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Hospital Wards" hint="Configuration and occupancy surveillance" />
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> Add Ward
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left">Ward Name</th>
                <th className="px-5 py-3 text-left">Location (Floor)</th>
                <th className="px-5 py-3 text-left">Bed Occupancy</th>
                <th className="px-5 py-3 text-left">Nurses Stationed</th>
                <th className="px-5 py-3 text-left">Doctor Contact</th>
                <th className="px-5 py-3 text-left">Safety Level</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {wards.map(w => {
                const wp = patients.filter(p => p.ward_id === w.id);
                const wn = nurses.filter(n => n.department === w.name);
                
                const criticalCount = wp.filter(p => p.latest_risk_level === "RED").length;
                const warningCount = wp.filter(p => p.latest_risk_level === "ORANGE").length;
                
                const status = criticalCount > 1 ? "Critical" : (criticalCount > 0 || warningCount > 1) ? "Strained" : "Operational";
                const tone = criticalCount > 1 ? "critical" : (criticalCount > 0 || warningCount > 1) ? "warning" : "success";

                return (
                  <tr key={w.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-semibold text-slate-800">{w.name} Ward</td>
                    <td className="px-5 py-4 text-muted-foreground">Floor {w.floor || 1}</td>
                    <td className="px-5 py-4 font-medium">
                      {wp.length} / {w.capacity || 20} beds ({Math.round(wp.length / (w.capacity || 20) * 100)}%)
                    </td>
                    <td className="px-5 py-4">{wn.length}</td>
                    <td className="px-5 py-4 text-xs font-medium text-slate-500 font-mono">
                      {w.doctor_phone ? `+${w.doctor_phone}` : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={tone}>{status}</StatusPill>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <IconBtn onClick={() => setSelectedWardId(w.id)} title="View Ward Detail">
                          <Eye className="h-4.5 w-4.5" />
                        </IconBtn>
                        <IconBtn onClick={() => { setActiveWard(w); setShowEdit(true); }} title="Edit Ward config">
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn onClick={() => handleDeleteWard(w.id, w.name)} title="Delete Ward">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Ward Modals */}
      {showAdd && (
        <WardModal
          onClose={() => setShowAdd(false)}
          onSave={loadData}
        />
      )}

      {showEdit && activeWard && (
        <WardModal
          ward={activeWard}
          onClose={() => { setShowEdit(false); setActiveWard(null); }}
          onSave={loadData}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// WARD FORM MODAL
// ─────────────────────────────────────────────
function WardModal({ ward, onClose, onSave }: { ward?: any; onClose: () => void; onSave: () => void }) {
  const isEdit = !!ward;
  const [form, setForm] = useState({
    name: ward?.name || "",
    floor: ward?.floor || "",
    capacity: ward?.capacity || 20,
    ward_type: ward?.ward_type || "General",
    doctor_phone: ward?.doctor_phone || "",
    callmebot_key: ward?.callmebot_key || "",
    senior_doctor_phone: ward?.senior_doctor_phone || "",
    nursing_supervisor_phone: ward?.nursing_supervisor_phone || "",
    admin_phone: ward?.admin_phone || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const payload = {
      ...form,
      floor: parseInt(form.floor as string),
      capacity: parseInt(form.capacity as string),
      doctor_phone: form.doctor_phone.replace(/\D/g, ""), // Keep numeric only
    };

    try {
      if (isEdit) {
        await updateWard(ward.id, payload);
        toast.success("Ward configuration updated!");
      } else {
        await createWard(payload);
        toast.success("New Hospital Ward registered!");
      }
      onSave();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed to save ward configurations.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <h3 className="font-display text-xl text-foreground font-bold">{isEdit ? "Edit Ward Configuration" : "Add New Ward"}</h3>
        <p className="text-sm text-muted-foreground mt-1">Configure telemetry settings and ward doctor routing.</p>
        
        {err && <div className="mt-3 rounded-xl bg-destructive/10 text-destructive text-xs p-3 border border-destructive/20">{err}</div>}
        
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-foreground">Ward Name *</span>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. ICU - Block C"
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-foreground">Floor *</span>
            <input
              type="number"
              value={form.floor}
              onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-foreground">Bed Capacity *</span>
            <input
              type="number"
              value={form.capacity}
              onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
              required
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-foreground">Ward Type</span>
            <select
              value={form.ward_type}
              onChange={e => setForm(f => ({ ...f, ward_type: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="General">General Ward</option>
              <option value="ICU">ICU (Intensive Care)</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Surgical">Surgical</option>
              <option value="Respiratory">Respiratory</option>
            </select>
          </label>

          <div className="sm:col-span-2 border-t border-border pt-3 mt-1">
            <div className="flex items-center gap-1.5 mb-3">
              <Phone className="h-3.5 w-3.5 text-red-500" />
              <span className="text-[11px] uppercase tracking-wider text-slate-700 font-bold">Escalation Chain — Auto SMS / Telegram</span>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 mb-3">
              🚨 Configure ALL 4 levels. System auto-escalates every 15 min if doctor doesn't respond!
            </div>
            <div className="space-y-2.5">
              {/* Level 1 */}
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Level 1 — Duty Doctor (IMMEDIATE)</div>
                  <input type="text" placeholder="919876543210" value={form.doctor_phone}
                    onChange={e => setForm(f => ({ ...f, doctor_phone: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-red-300 text-xs font-mono" />
                </div>
              </div>
              {/* Level 2 */}
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Level 2 — Senior Doctor / Consultant (+15 min)</div>
                  <input type="text" placeholder="919876543211" value={form.senior_doctor_phone}
                    onChange={e => setForm(f => ({ ...f, senior_doctor_phone: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-orange-300 text-xs font-mono" />
                </div>
              </div>
              {/* Level 3 */}
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-yellow-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">Level 3 — Nursing Supervisor / HOD (+30 min)</div>
                  <input type="text" placeholder="919876543212" value={form.nursing_supervisor_phone}
                    onChange={e => setForm(f => ({ ...f, nursing_supervisor_phone: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-yellow-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-300 text-xs font-mono" />
                </div>
              </div>
              {/* Level 4 */}
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-slate-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Level 4 — Admin Office / Medical Superintendent (+45 min)</div>
                  <input type="text" placeholder="919876543213" value={form.admin_phone}
                    onChange={e => setForm(f => ({ ...f, admin_phone: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 text-xs font-mono" />
                </div>
              </div>
              {/* CallMeBot WhatsApp key */}
              <div className="pt-1 border-t border-border">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">CallMeBot WhatsApp API Key (Optional)</div>
                <input type="text" placeholder="123456" value={form.callmebot_key}
                  onChange={e => setForm(f => ({ ...f, callmebot_key: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 text-xs font-mono" />
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 border-t border-border pt-4 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium hover:bg-muted">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60 flex items-center gap-1.5"
            >
              {saving ? "Saving..." : isEdit ? "Update Ward" : "Register Ward"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="mt-1 font-display text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white hover:border-primary/30 hover:bg-primary-soft/50 shadow-sm transition">
      {children}
    </button>
  );
}