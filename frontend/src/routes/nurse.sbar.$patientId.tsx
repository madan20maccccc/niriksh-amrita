import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, Loader2, Languages, Sparkles, AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/section";
import { Logo } from "@/components/brand/Logo";
import { getPatient, getPatientSbars, generateSbarNow } from "@/lib/api";

export const Route = createFileRoute("/nurse/sbar/$patientId")({ component: SbarPage });

function SbarPage() {
  const { patientId } = useParams({ from: "/nurse/sbar/$patientId" });
  const pId = parseInt(patientId);

  const [patient, setPatient] = useState<any>(null);
  const [sbar, setSbar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>("english");
  const [error, setError] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const pData = await getPatient(pId);
      setPatient(pData);

      const sbars = await getPatientSbars(pId);
      if (sbars && sbars.length > 0) {
        setSbar(sbars[0]);
      } else {
        setSbar(null);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load SBAR data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pId]);

  const handleLanguageChange = async (lang: string) => {
    setSelectedLang(lang);
    if (lang === "english") {
      setAiWarning(null);
      return;
    }
    setGenerating(true);
    setAiWarning(null);
    try {
      const report = await generateSbarNow(pId, lang);
      if ((report as any).translation_error) {
        setAiWarning("⚠️ " + (report as any).translation_error);
      } else {
        setSbar(report);
        setAiWarning(null);
      }
    } catch (err: any) {
      setAiWarning("⚠️ Translation temporarily unavailable. Showing English version.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateNow = async () => {
    setGenerating(true);
    setError(null);
    setAiWarning(null);
    try {
      const report = await generateSbarNow(pId);
      setSbar(report);
      if (report.generated_by === "template") {
        setAiWarning("ℹ️ Generated using clinical rules (AI unavailable — check your Gemini API key).");
      }
    } catch (err: any) {
      setError("No vitals recorded yet. Please enter vitals for this patient first, then generate SBAR.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading handover documents...</p>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20 shadow-card">
        <h3 className="font-display text-xl font-bold">Error</h3>
        <p className="mt-2 text-sm">{error}</p>
        <Link to={`/nurse/patient/${pId}` as never} className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">← Back to Patient</Link>
      </div>
    );
  }

  const blocks = sbar ? [
    { key: "S", t: "Situation", body: sbar.situation },
    { key: "B", t: "Background", body: sbar.background },
    { key: "A", t: "Assessment", body: sbar.assessment },
    { key: "R", t: "Recommendation", body: sbar.recommendation },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to={`/nurse/patient/${pId}` as never} className="text-sm text-primary hover:underline font-semibold">
          ← Back to {patient?.full_name}
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            disabled={!sbar}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
        </div>
      </div>

      <Card className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <Logo size={40} withWordmark tone="compact" />

          {/* Multilingual Translation Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-slate-50 p-1.5 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground px-2 flex items-center gap-1">
              <Languages className="h-3.5 w-3.5" /> Language:
            </span>
            {[
              { id: "english", label: "English" },
              { id: "hindi", label: "हिंदी (Hindi)" },
              { id: "tamil", label: "தமிழ் (Tamil)" },
              { id: "malayalam", label: "മലയാളം (Malayalam)" },
              { id: "telugu", label: "తెలుగు (Telugu)" },
              { id: "kannada", label: "ಕನ್ನಡ (Kannada)" }
            ].map(lang => (
              <button
                key={lang.id}
                onClick={() => handleLanguageChange(lang.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  selectedLang === lang.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <div className="text-right text-xs text-muted-foreground">
            <div>SBAR Handover Note</div>
            <div className="font-medium text-foreground">
              {sbar ? new Date(sbar.generated_at).toLocaleString() : new Date().toLocaleString()}
            </div>
          </div>
        </div>

        {/* Patient info row */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm bg-muted/20 p-4 rounded-2xl border border-border">
          <KV k="Patient Name" v={patient?.full_name || "—"} />
          <KV k="Age / Gender" v={`${patient?.age} years · ${patient?.gender === "M" ? "Male" : "Female"}`} />
          <KV k="Bed Number" v={`Bed ${patient?.bed_number}`} />
          <KV k="Primary Diagnosis" v={patient?.primary_diagnosis || "—"} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive font-medium border border-destructive/20">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* AI warning / info banner */}
        {aiWarning && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800 font-medium border border-amber-200">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            {aiWarning}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {generating ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs uppercase tracking-widest">Generating clinical summary...</p>
            </div>
          ) : sbar ? (
            <>
              {blocks.map(b => (
                <div key={b.key} className="rounded-2xl border border-border bg-background/60 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
                      {b.key}
                    </div>
                    <div className="font-display text-lg font-semibold text-foreground">{b.t}</div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground whitespace-pre-line">{b.body}</p>
                </div>
              ))}

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-4 justify-end">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>Summary generated by {sbar.generated_by}</span>
              </div>

              {/* Re-generate button */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleGenerateNow}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Regenerate SBAR
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                No shift handover report has been generated yet for this patient.
              </p>
              <button
                onClick={handleGenerateNow}
                disabled={generating}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95 flex items-center gap-1.5 mx-auto disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate SBAR Summary
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{k}</div>
      <div className="font-medium text-foreground mt-0.5">{v}</div>
    </div>
  );
}