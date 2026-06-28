import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, KeyRound, Filter, Loader2, RefreshCw } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { getNurses, getWards, request, deactivateUser, resetUserPassword } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/nurses")({ component: NursesPage });

function NursesPage() {
  const [nurses, setNurses] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [wardFilter, setWardFilter] = useState<string>("All");
  const [showAdd, setShowAdd] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nData, wData] = await Promise.all([getNurses(), getWards()]);
      setNurses(nData);
      setWards(wData);
    } catch (err: any) {
      setError(err.message || "Failed to load nursing staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = nurses.filter(n =>
    (wardFilter === "All" || n.department === wardFilter) &&
    (n.full_name.toLowerCase().includes(q.toLowerCase()) ||
      n.employee_id.toLowerCase().includes(q.toLowerCase()) ||
      (n.email || "").toLowerCase().includes(q.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading nursing staff registry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20">
        <h3 className="font-display text-xl font-bold">Staff Registry Offline</h3>
        <p className="mt-2 text-sm">{error}</p>
        <button onClick={loadData} className="mt-4 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold">
          Retry
        </button>
      </div>
    );
  }

  const activeCount = nurses.filter(n => n.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Nursing Staff"
          hint={`${nurses.length} nurses · ${activeCount} on duty`}
        />
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-white hover:bg-muted shadow-sm">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> Add Nurse
          </button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-white px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, employee ID, or email"
              className="w-full bg-transparent outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-input bg-white px-3 py-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={wardFilter} onChange={e => setWardFilter(e.target.value)} className="bg-transparent outline-none">
              <option>All</option>
              {wards.map(w => <option key={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Staff", value: nurses.length },
          { label: "On Duty", value: nurses.filter(n => n.is_active).length },
          { label: "Nurses", value: nurses.filter(n => n.role === "nurse").length },
          { label: "Supervisors", value: nurses.filter(n => n.role === "supervisor").length },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</div>
            <div className="mt-1 font-display text-2xl font-bold text-foreground">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No staff members found matching your filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Employee ID</th>
                <th className="px-5 py-3 text-left">Contact</th>
                <th className="px-5 py-3 text-left">Department / Ward</th>
                <th className="px-5 py-3 text-left">Role</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(n => (
                <tr key={n.id} className="hover:bg-primary-soft/20 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft font-semibold text-primary text-sm">
                        {n.full_name[0]}
                      </div>
                      <div className="font-medium text-foreground">{n.full_name}</div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{n.employee_id}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <div>{n.email}</div>
                    {n.phone && <div className="text-xs">{n.phone}</div>}
                  </td>
                  <td className="px-5 py-3">{n.department || "—"}</td>
                  <td className="px-5 py-3">
                    <span className="capitalize inline-flex items-center rounded-full bg-primary-soft/60 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {n.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill tone={n.is_active ? "success" : "muted"}>
                      {n.is_active ? "On Duty" : "Inactive"}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn onClick={() => handleResetPassword(n.id, n.full_name)} title="Reset password"><KeyRound className="h-4 w-4" /></IconBtn>
                      <IconBtn title="Edit"><Pencil className="h-4 w-4" /></IconBtn>
                      <IconBtn onClick={() => handleDeactivate(n.id, n.full_name)} title="Deactivate"><Trash2 className="h-4 w-4 text-[var(--color-critical)]" /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showAdd && <AddNurseModal wards={wards} onClose={() => setShowAdd(false)} onSave={loadData} />}
    </div>
  );

  async function handleDeactivate(id: number, name: string) {
    if (!window.confirm(`Are you sure you want to deactivate ${name}'s account? They will not be able to log in.`)) {
      return;
    }
    try {
      await deactivateUser(id);
      toast.success(`Account for ${name} deactivated successfully.`);
      loadData();
    } catch (err: any) {
      toast.error(`Failed to deactivate user: ${err.message || "Server issue"}`);
    }
  }

  async function handleResetPassword(id: number, name: string) {
    const newPassword = window.prompt(`Enter a new password for ${name}:`);
    if (newPassword === null) return;
    if (newPassword.trim().length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    try {
      await resetUserPassword(id, { password: newPassword });
      toast.success(`Password for ${name} reset successfully.`);
    } catch (err: any) {
      toast.error(`Failed to reset password: ${err.message || "Server issue"}`);
    }
  }
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white hover:border-primary/30 hover:bg-primary-soft/50 transition"
    >
      {children}
    </button>
  );
}

function AddNurseModal({ wards, onClose, onSave }: { wards: any[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    full_name: "", employee_id: "", email: "", phone: "", password: "", role: "nurse", department: ""
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await request("/auth/register", {
        method: "POST",
        body: JSON.stringify(form)
      });
      onSave();
      onClose();
    } catch (error: any) {
      setErr(error.message || "Failed to create nurse.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <h3 className="font-display text-xl text-foreground font-bold">Add Nursing Staff</h3>
        <p className="text-sm text-muted-foreground mt-1">Register a new nurse or supervisor account.</p>
        {err && <div className="mt-3 rounded-xl bg-destructive/10 text-destructive text-xs p-3 border border-destructive/20">{err}</div>}
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <Field label="Full Name" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} required />
          <Field label="Employee ID" value={form.employee_id} onChange={v => setForm(f => ({ ...f, employee_id: v }))} required />
          <Field label="Email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required />
          <Field label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <Field label="Password" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} required />
          <SelectField
            label="Role"
            options={["nurse", "supervisor", "doctor"]}
            value={form.role}
            onChange={v => setForm(f => ({ ...f, role: v }))}
          />
          <SelectField
            label="Assigned Ward / Department"
            options={wards.map(w => w.name)}
            value={form.department}
            onChange={v => setForm(f => ({ ...f, department: v }))}
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Nurse"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, required, className }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean; className?: string;
}) {
  return (
    <label className={"block text-sm " + (className ?? "")}>
      <span className="font-medium text-foreground">{label}{required && <span className="text-destructive ml-0.5">*</span>}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function SelectField({ label, options, value, onChange, className }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; className?: string;
}) {
  return (
    <label className={"block text-sm " + (className ?? "")}>
      <span className="font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">Select...</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}