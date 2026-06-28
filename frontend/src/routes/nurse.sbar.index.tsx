import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/section";
import { getPatients } from "@/lib/api";

export const Route = createFileRoute("/nurse/sbar/")({ component: SbarIndex });

function SbarIndex() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPatients() {
      try {
        const data = await getPatients();
        setPatients(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load patients for SBAR");
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

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
      <SectionHeader title="SBAR Handover Center" hint="Select a patient to view or generate structured clinical handover summaries" />
      <Card className="p-4">
        {patients.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No patients assigned to you on this shift.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {patients.map(p => (
              <li key={p.id}>
                <Link to={`/nurse/sbar/${p.id}` as never} className="flex items-center justify-between rounded-xl p-3.5 hover:bg-primary-soft/30 hover:px-4 transition duration-200">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Bed {p.bed_number} · {p.primary_diagnosis}</div>
                  </div>
                  <span className="text-sm font-semibold text-primary">Prepare Handover SBAR →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}