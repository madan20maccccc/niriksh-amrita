import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, HeartPulse, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import logoImg from "@/assets/logo_fina.png";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome — NirikshAmrita" },
      { name: "description", content: "Agentic AI nursing safety and patient monitoring for Amrita Hospital. Watching every patient. Supporting every nurse. Protecting every life." },
      { property: "og:title", content: "Welcome to NirikshAmrita" },
      { property: "og:description", content: "Enterprise-grade nursing safety and ward monitoring platform." },
    ],
  }),
  component: Welcome,
});

export function Welcome() {
  const [active, setActive] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Start sliding up at 3.5 seconds
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 3500);

    // Unmount splash at 4.3 seconds
    const finishTimer = setTimeout(() => {
      setActive(false);
    }, 4300);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, []);

  const handleBypass = () => {
    setIsExiting(true);
    setTimeout(() => {
      setActive(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Logo size={52} withWordmark tone="compact" />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Platform</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#trust" className="hover:text-foreground">Clinical Safety</a>
          </nav>
          <Link
            to="/role"
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition hover:opacity-95"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 right-[-10%] h-[520px] w-[520px] rounded-full bg-primary-soft blur-3xl opacity-70" />
          <div className="absolute -bottom-40 left-[-8%] h-[420px] w-[420px] rounded-full bg-accent blur-3xl opacity-60" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/15">
              <Sparkles className="h-3.5 w-3.5" /> Agentic AI for clinical safety
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-foreground sm:text-6xl">
              NirikshAmrita
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Agentic AI Nursing Safety & Patient Monitoring Platform —
              built with Amrita Hospital clinicians for ward-level vigilance, faster
              escalation, and calmer nursing workflows.
            </p>
            <p className="mt-6 font-display text-xl text-primary">
              Watching every patient. Supporting every nurse. Protecting every life.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/role"
                className="rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:opacity-95"
              >
                Get started
              </Link>
              <a
                href="#features"
                className="rounded-full border border-border bg-white px-7 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                Learn more
              </a>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> HIPAA-aligned</div>
              <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Real-time vitals</div>
              <div className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> SBAR handover</div>
            </div>
          </div>

          <div className="relative">
            <div className="relative rounded-3xl border border-border bg-white p-6 shadow-elegant">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl gradient-primary" />
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">ICU · Bay 3</div>
                    <div className="font-display text-base text-foreground">Bed ICU-07 · Mrs. Ananya R.</div>
                  </div>
                </div>
                <span className="rounded-full bg-[color-mix(in_oklab,var(--color-critical)_14%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--color-critical)] ring-1 ring-[color-mix(in_oklab,var(--color-critical)_30%,transparent)]">
                  Critical
                </span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { l: "SpO₂", v: "89%", t: "critical" },
                  { l: "HR", v: "126", t: "warning" },
                  { l: "BP", v: "162/98", t: "warning" },
                  { l: "RR", v: "26", t: "warning" },
                  { l: "Temp", v: "100.4°F", t: "info" },
                  { l: "Pain", v: "6/10", t: "info" },
                ].map(c => (
                  <div key={c.l} className="rounded-xl border border-border bg-background/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.l}</div>
                    <div className="font-display text-lg text-foreground">{c.v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-primary-soft p-4 text-sm text-foreground ring-1 ring-primary/10">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> NirikshAmrita AI
                </div>
                <p className="mt-2 leading-relaxed">
                  Desaturation trend over last 40 min. Recommend re-checking SpO₂,
                  titrating oxygen and informing on-call physician.
                </p>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border bg-white p-4 shadow-card md:block">
              <div className="flex items-center gap-3">
                <HeartPulse className="h-5 w-5 text-primary" />
                <div className="text-sm">
                  <div className="font-medium">12 alerts resolved</div>
                  <div className="text-xs text-muted-foreground">in the last hour · ICU</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-border/60 bg-gradient-to-b from-background to-primary-soft/30">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl text-foreground sm:text-4xl">
              A calmer ward. A safer patient.
            </h2>
            <p className="mt-3 text-muted-foreground">
              NirikshAmrita brings together vitals, alerts, AI summaries and SBAR
              handover in one elegant surface for every nurse and administrator.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: Activity, title: "Live ward risk", body: "Real-time risk scores per ward, bed and patient with prioritized alerting." },
              { icon: Sparkles, title: "Agentic AI insights", body: "Human-readable explanations and recommended next clinical actions." },
              { icon: Stethoscope, title: "SBAR handover", body: "Structured Situation-Background-Assessment-Recommendation reports in one click." },
              { icon: ShieldCheck, title: "Escalation safety net", body: "Missed vitals and threshold breaches escalate automatically to charge nurse." },
              { icon: HeartPulse, title: "Vitals & trends", body: "14-day morning, evening and night trends across BP, HR, SpO₂, sugar and more." },
              { icon: Logo as never, title: "Built for Amrita", body: "Designed with Amrita Hospital clinical teams for Indian ward realities." },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl border border-border bg-white p-6 shadow-card transition hover:shadow-elegant">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  {i === 5 ? <Logo size={22} /> : <f.icon className="h-5 w-5" />}
                </div>
                <h3 className="mt-4 font-display text-lg text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer id="trust" className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <Logo size={32} withWordmark tone="compact" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Amrita Hospital · NirikshAmrita Clinical AI Platform.
          </p>
        </div>
      </footer>

      {active && (
        <div
          onClick={handleBypass}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transform transition-transform duration-1000 ease-[cubic-bezier(0.85,0,0.15,1)] cursor-pointer ${
            isExiting ? "translate-y-[-100%]" : "translate-y-0"
          }`}
          title="Click to enter platform"
        >
          {/* Ambient light pink/crimson gradient backdrops */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-tr from-rose-50/50 via-white to-pink-50/50">
            <div className="absolute top-[40%] left-[50%] h-[550px] w-[550px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px] opacity-75 animate-[pulse_4s_infinite]" />
            <div className="absolute bottom-[-100px] left-[10%] h-[350px] w-[350px] rounded-full bg-accent/5 blur-[80px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-xl px-6">
            {/* Logo: Beautiful card with curved edges (rounded-3xl) to blend the rectangular graphic */}
            <div 
              className="relative flex h-[300px] w-[300px] items-center justify-center bg-white rounded-[40px] p-6 shadow-elegant border border-primary/10 drop-shadow-[0_15px_30px_rgba(219,39,119,0.08)] overflow-hidden"
              style={{
                animation: "floatLogo 4s ease-in-out infinite"
              }}
            >
              <img src={logoImg} className="h-full w-full object-contain rounded-[24px]" alt="NirikshAmrita Logo" />
            </div>

            {/* Premium Slogan Reveal */}
            <div className="space-y-3 mt-2">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/90 font-bold">
                Clinical Safety & Ward Surveillance
              </p>
              <div className="h-[2px] w-12 bg-primary/20 mx-auto rounded-full" />
              <p className="text-base font-medium text-primary leading-relaxed font-display max-w-sm mx-auto">
                "Watching every patient. Supporting every nurse. Protecting every life."
              </p>
            </div>

            {/* Sleek crimson glow-loading track */}
            <div className="mt-6 space-y-3 w-64 mx-auto">
              <div className="relative h-[3px] bg-primary-soft/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-pink-500 rounded-full"
                  style={{
                    width: isExiting ? "100%" : "0%",
                    animation: "fillProgress 3.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards"
                  }}
                />
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-primary/70 animate-pulse font-bold">
                Loading Platform...
              </div>
            </div>
          </div>

          <style>{`
            @keyframes fillProgress {
              from { width: 0%; }
              to { width: 100%; }
            }
            @keyframes floatLogo {
              0%, 100% { transform: translateY(0px) scale(1); }
              50% { transform: translateY(-12px) scale(1.03); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}