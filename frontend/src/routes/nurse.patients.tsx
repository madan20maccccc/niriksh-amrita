import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill, riskTone } from "@/components/ui/status-pill";
import { getPatients } from "@/lib/api";

export const Route = createFileRoute("/nurse/patients")({ component: NursePatients });

function NursePatients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    async function loadPatients() {
      try {
        const data = await getPatients();
        setPatients(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load patients");
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
    const interval = setInterval(loadPatients, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredPatients = patients.filter(p =>
    p.full_name.toLowerCase().includes(q.toLowerCase()) || 
    p.bed_number.toLowerCase().includes(q.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-destructive/10 p-5 text-center text-destructive border border-destructive/20 max-w-md mx-auto mt-10">
        <h3 className="font-semibold text-lg">Error loading patients</h3>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="My Patients" hint={`${filteredPatients.length} patients assigned to you`} />
      <Card className="p-4">
        <div className="flex items-center gap-2 rounded-xl border border-input bg-white px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or bed" className="w-full bg-transparent outline-none" />
        </div>
      </Card>
      
      {filteredPatients.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No patients assigned to you on this shift.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPatients.map(p => {
            const risk = p.latest_risk_level || "Low";
            const bpText = p.latest_systolic_bp && p.latest_diastolic_bp 
              ? `${Math.round(p.latest_systolic_bp)}/${Math.round(p.latest_diastolic_bp)}` 
              : "N/A";
            
            return (
              <Card key={p.id} className="p-5 transition hover:shadow-elegant">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft font-medium text-primary">
                      {p.full_name[0]}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{p.full_name}</div>
                      <div className="text-xs text-muted-foreground">Bed {p.bed_number} · {p.age}{p.gender}</div>
                    </div>
                  </div>
                  <StatusPill tone={riskTone(risk as any)}>{risk}</StatusPill>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{p.primary_diagnosis}</div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Vital l="BP" v={bpText} />
                  <Vital l="HR" v={p.latest_heart_rate ? String(Math.round(p.latest_heart_rate)) : "N/A"} />
                  <Vital l="SpO₂" v={p.latest_spo2 ? `${Math.round(p.latest_spo2)}%` : "N/A"} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link to={`/nurse/patient/${p.id}` as never} className="flex-1 rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-elegant">View details</Link>
                  <Link to={`/nurse/vitals/${p.id}` as never} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">Enter vitals</Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Vital({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
      <div className="text-sm font-medium text-foreground">{v}</div>
    </div>
  );
}