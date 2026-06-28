import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Eye, Hospital, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { getWards, getPatients, getNurses } from "@/lib/api";

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
    // In our database schema:
    // Patient has ward_id
    // Nurse / User model doesn't explicitly have ward_id unless stored in department. We can match nurse.department with ward.name or similar.
    const wp = patients.filter(p => p.ward_id === selectedWard.id);
    // Let's match nurses by department
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
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95">
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
                    <td className="px-5 py-4 font-semibold text-foreground">{w.name} Ward</td>
                    <td className="px-5 py-4 text-muted-foreground">Floor {w.floor || 1}</td>
                    <td className="px-5 py-4 font-medium">
                      {wp.length} / {w.capacity || 20} beds ({Math.round(wp.length / (w.capacity || 20) * 100)}%)
                    </td>
                    <td className="px-5 py-4">{wn.length}</td>
                    <td className="px-5 py-4">
                      <StatusPill tone={tone}>{status}</StatusPill>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <IconBtn onClick={() => setSelectedWardId(w.id)}>
                          <Eye className="h-4.5 w-4.5" />
                        </IconBtn>
                        <IconBtn>
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn>
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

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white hover:border-primary/30 hover:bg-primary-soft/50 shadow-sm transition">
      {children}
    </button>
  );
}