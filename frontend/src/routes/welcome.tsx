import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity, HeartPulse, ShieldCheck, Sparkles, Stethoscope,
  Bell, BarChart3, Brain, Users, Zap, ChevronRight, ArrowRight,
  CheckCircle, Clock, Shield, TrendingUp, AlertTriangle, Radio
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Logo } from "@/components/brand/Logo";
import logoImg from "@/assets/logo_fina.png";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome — NirikshAmrita" },
      { name: "description", content: "Agentic AI nursing safety and patient monitoring for Amrita Hospital." },
    ],
  }),
  component: Welcome,
});

// ----------- Typing animation hook -----------
function useTypingEffect(texts: string[], speed = 45, pause = 1800) {
  const [displayed, setDisplayed] = useState("");
  const [textIdx, setTextIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = texts[textIdx];
    if (!deleting) {
      if (charIdx < current.length) {
        const t = setTimeout(() => setCharIdx(c => c + 1), speed);
        setDisplayed(current.slice(0, charIdx + 1));
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setDeleting(true), pause);
        return () => clearTimeout(t);
      }
    } else {
      if (charIdx > 0) {
        const t = setTimeout(() => setCharIdx(c => c - 1), speed / 2);
        setDisplayed(current.slice(0, charIdx - 1));
        return () => clearTimeout(t);
      } else {
        setDeleting(false);
        setTextIdx(i => (i + 1) % texts.length);
      }
    }
  }, [charIdx, deleting, textIdx, texts, speed, pause]);

  return displayed;
}

// ----------- Animated counter -----------
function AnimatedCounter({ target, suffix = "", duration = 1800 }: { target: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 60;
        const inc = target / steps;
        let cur = 0;
        const interval = setInterval(() => {
          cur += inc;
          if (cur >= target) {
            setVal(target);
            clearInterval(interval);
          } else {
            setVal(Math.floor(cur));
          }
        }, duration / steps);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ----------- Feature card data -----------
const FEATURES = [
  {
    icon: Brain,
    color: "text-violet-600",
    bg: "bg-violet-50",
    ring: "ring-violet-200",
    title: "AI Early Warning Engine",
    desc: "Continuously monitors NEWS2 scores across all wards. Our agent detects deteriorating vitals patterns up to 6 hours before clinical emergencies develop.",
    badge: "Predictive",
    badgeColor: "bg-violet-100 text-violet-700",
  },
  {
    icon: Bell,
    color: "text-rose-600",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
    title: "Smart Escalation Protocol",
    desc: "Automated 4-tier escalation cascade. From bedside nurse alert to duty doctor emergency page — no alarm is ever missed, even if staff are occupied.",
    badge: "Safety Net",
    badgeColor: "bg-rose-100 text-rose-700",
  },
  {
    icon: Stethoscope,
    color: "text-primary",
    bg: "bg-primary-soft",
    ring: "ring-primary/20",
    title: "Agentic SBAR Handover",
    desc: "AI-generated SBAR reports for every patient at every shift change. Structured, consistent, and instant — saving nurses 12+ minutes per handover.",
    badge: "AI Generated",
    badgeColor: "bg-pink-100 text-pink-700",
  },
  {
    icon: BarChart3,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    title: "Ward Command Center",
    desc: "Real-time bird's-eye view of every bed in every ward. Colour-coded by NEWS2 risk, with live vital trends updated every 2 minutes.",
    badge: "Live Dashboard",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: Shield,
    color: "text-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    title: "Clinical Compliance Engine",
    desc: "Automated documentation of all nursing observations. Audit trails, timestamps, and digital sign-offs built in by default — fully NABH-ready.",
    badge: "NABH Ready",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    icon: TrendingUp,
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    title: "Predictive Vitals Analytics",
    desc: "Linear regression trendlines on every vital sign. The system flags a patient before they cross the critical threshold — proactive, not reactive.",
    badge: "ML Powered",
    badgeColor: "bg-amber-100 text-amber-700",
  },
];

// ----------- Escalation steps -----------
const ESCALATION_STEPS = [
  { icon: Activity, label: "Vitals Captured", desc: "Auto-calculated NEWS2 score", color: "bg-primary text-white" },
  { icon: Bell, label: "Nurse Notified", desc: "Instant push alert to assigned nurse", color: "bg-rose-500 text-white" },
  { icon: Users, label: "Supervisor Alerted", desc: "Triggered if unacknowledged in 5 min", color: "bg-violet-600 text-white" },
  { icon: AlertTriangle, label: "Doctor Emergency Page", desc: "Final safety net for critical events", color: "bg-amber-500 text-white" },
];

// ----------- AI Agent Demo Messages -----------
const AI_DEMO_LOG = [
  { from: "system", text: "NirikshAmrita Clinical Safety Agent v2.1 — Online" },
  { from: "agent", text: "🔍 Scanning Ward D vitals... All 14 patients checked." },
  { from: "agent", text: "⚠️ Flagging Bed D-07 — NEWS2 rose from 3 → 6 in last 45 minutes." },
  { from: "agent", text: "📋 SBAR report auto-generated for shift handover at 14:00 hrs." },
  { from: "agent", text: "✅ Nurse Shalini acknowledged Bed D-07 alert. Escalation paused." },
  { from: "agent", text: "📡 Closure check scheduled in 15 minutes for Bed D-07 follow-up." },
];

export function Welcome() {
  const [splashActive, setSplashActive] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [logLines, setLogLines] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const heroText = useTypingEffect([
    "Watching every patient.",
    "Supporting every nurse.",
    "Protecting every life.",
    "Alerting before crisis hits.",
  ], 50, 1600);

  // Splash dismiss
  useEffect(() => {
    const t1 = setTimeout(() => setIsExiting(true), 3500);
    const t2 = setTimeout(() => setSplashActive(false), 4300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // AI log feed animation
  useEffect(() => {
    if (splashActive) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setLogLines(i);
      if (i >= AI_DEMO_LOG.length) clearInterval(interval);
    }, 900);
    return () => clearInterval(interval);
  }, [splashActive]);

  // Escalation step auto-advance
  useEffect(() => {
    if (splashActive) return;
    const interval = setInterval(() => {
      setActiveStep(s => (s + 1) % ESCALATION_STEPS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [splashActive]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ─── Sticky Header ─── */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Logo size={52} withWordmark tone="compact" />
          <div className="hidden items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground md:flex">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            AI Safety Engine: <span className="font-semibold text-foreground ml-1">Online</span>
          </div>
          <Link to="/role" className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95 transition">
            Enter Platform
          </Link>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden border-b border-border/40">
        {/* Soft background blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-rose-100/40 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Headline */}
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary ring-1 ring-primary/15">
              <Sparkles className="h-3.5 w-3.5" /> Amrita Institute of Medical Sciences
            </span>

            <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
              NirikshAmrita
              <br />
              <span className="text-primary">Clinical Safety</span>
            </h1>

            <div className="h-14 flex items-center">
              <p className="text-xl sm:text-2xl text-muted-foreground font-medium">
                <span className="text-foreground font-semibold">{heroText}</span>
                <span className="inline-block w-0.5 h-6 bg-primary ml-1 animate-pulse align-middle" />
              </p>
            </div>

            <p className="text-base text-muted-foreground max-w-md leading-relaxed">
              An agentic AI platform that watches over every patient in real-time, automates clinical escalations, and supports nurses with intelligent shift handover reports — 24/7, without fail.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link to="/role" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-sm text-primary-foreground shadow-elegant hover:opacity-95 transition">
                Enter Platform <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-6 py-3 font-semibold text-sm text-foreground hover:bg-muted/50 transition">
                See How It Works <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            {/* Quick trust badges */}
            <div className="flex flex-wrap gap-4 pt-2">
              {[
                { icon: CheckCircle, text: "NABH Aligned" },
                { icon: Shield, text: "Privacy First" },
                { icon: Clock, text: "24/7 Monitoring" },
              ].map(b => (
                <div key={b.text} className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                  <b.icon className="h-3.5 w-3.5 text-primary" /> {b.text}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live AI Agent Log Demo */}
          <div className="rounded-3xl border border-border bg-white shadow-elegant overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                niriksh-agent · live
              </div>
              <div />
            </div>

            {/* Log lines */}
            <div className="bg-slate-950 px-5 py-5 font-mono text-xs space-y-3 min-h-[260px]">
              {AI_DEMO_LOG.slice(0, logLines).map((line, i) => (
                <div key={i} className={`flex gap-2 items-start ${i === logLines - 1 ? "animate-[fadeIn_0.3s_ease]" : ""}`}>
                  <span className="text-slate-500 shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <span className={line.from === "system" ? "text-slate-500" : "text-emerald-400"}>
                    {line.from === "agent" && <span className="text-primary mr-1">›</span>}
                    {line.text}
                  </span>
                </div>
              ))}
              {logLines < AI_DEMO_LOG.length && (
                <div className="flex gap-2 items-center text-slate-600">
                  <span className="text-slate-500">{String(logLines + 1).padStart(2, "0")}</span>
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">NirikshAmrita Agent — Live Demo</span>
              <span className="text-[10px] text-emerald-600 font-bold">● Connected</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Platform Stats ─── */}
      <section className="border-b border-border/40 bg-muted/20">
        <div className="mx-auto max-w-7xl px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Patient Vitals Monitored / Day", value: 2847, suffix: "+" },
            { label: "Clinical Escalations Handled", value: 98, suffix: "%" },
            { label: "Minutes Saved Per Nurse/Shift", value: 23, suffix: "+" },
            { label: "Early Warning Accuracy", value: 94, suffix: "%" },
          ].map(s => (
            <div key={s.label} className="text-center space-y-1">
              <div className="font-display text-4xl font-bold text-primary">
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs text-muted-foreground font-medium leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-6 py-20 space-y-14">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary ring-1 ring-primary/15">
              <Zap className="h-3.5 w-3.5" /> Automated Escalation
            </span>
            <h2 className="font-display text-3xl font-bold text-foreground">How the Safety Net Works</h2>
            <p className="text-muted-foreground text-sm">Watch the live simulation of our 4-tier escalation cascade — running automatically with zero nurse input required.</p>
          </div>

          {/* Animated Escalation Chain */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ESCALATION_STEPS.map((step, i) => {
              const isActive = i === activeStep;
              const isDone = i < activeStep;
              return (
                <div key={step.label} className={`relative rounded-2xl border p-5 flex flex-col items-center text-center gap-3 transition-all duration-500 ${isActive ? "border-primary bg-primary-soft/30 shadow-elegant scale-105" : isDone ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-white opacity-60"}`}>
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${isActive ? step.color : isDone ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"} transition-all duration-500`}>
                    {isDone ? <CheckCircle className="h-6 w-6" /> : <step.icon className="h-6 w-6" />}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">{step.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</div>
                  </div>
                  {isActive && (
                    <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center animate-bounce">
                      <span className="text-[8px] text-white font-bold">●</span>
                    </div>
                  )}
                  {/* Connector arrow */}
                  {i < ESCALATION_STEPS.length - 1 && (
                    <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                      <ChevronRight className="h-5 w-5 text-border" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Live simulation cycling through the 4 stages — each stage activates automatically in real scenarios.
          </p>
        </div>
      </section>

      {/* ─── Feature Grid ─── */}
      <section className="border-b border-border/40 bg-muted/10">
        <div className="mx-auto max-w-7xl px-6 py-20 space-y-12">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary ring-1 ring-primary/15">
              <HeartPulse className="h-3.5 w-3.5" /> Platform Capabilities
            </span>
            <h2 className="font-display text-3xl font-bold text-foreground">Everything Your Ward Needs</h2>
            <p className="text-muted-foreground text-sm">Six powerful AI modules, seamlessly integrated into a single nursing platform.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const isActive = activeFeature === i;
              return (
                <button
                  key={f.title}
                  onClick={() => setActiveFeature(i)}
                  className={`text-left p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-3.5 ${isActive ? `${f.bg} ${f.ring} ring-1 shadow-elegant scale-[1.02]` : "border-border bg-white hover:border-primary/20 hover:shadow-sm"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isActive ? f.bg : "bg-muted"} ${f.ring} ${isActive ? "ring-1" : ""} transition-all`}>
                      <f.icon className={`h-5 w-5 ${isActive ? f.color : "text-muted-foreground"}`} />
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 ${isActive ? f.badgeColor : "bg-muted text-muted-foreground"}`}>
                      {f.badge}
                    </span>
                  </div>
                  <div>
                    <div className={`font-display font-bold text-sm ${isActive ? "text-foreground" : "text-foreground"}`}>{f.title}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/6 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-3xl px-6 py-24 text-center space-y-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary ring-1 ring-primary/15">
            <ShieldCheck className="h-3.5 w-3.5" /> Ready to Use
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground leading-tight">
            The Future of Ward Safety.<br />
            <span className="text-primary">Available Today.</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base leading-relaxed">
            Log in to access the full clinical command center. Monitor your wards, manage escalations, and generate handover reports — all from one secure platform.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/role" className="inline-flex items-center gap-2.5 rounded-full bg-primary px-8 py-3.5 font-bold text-sm text-primary-foreground shadow-elegant hover:opacity-95 transition text-base">
              Enter Clinical Platform <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 pt-4">
            {[
              { icon: Users, text: "Multi-Role Access" },
              { icon: Activity, text: "Live Vitals Stream" },
              { icon: Brain, text: "AI-Powered Alerts" },
            ].map(b => (
              <div key={b.text} className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                <b.icon className="h-4 w-4 text-primary" /> {b.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5">
            <Logo size={42} withWordmark tone="compact" />
            <p className="text-[10px] text-muted-foreground max-w-md">
              * NirikshAmrita assists healthcare professionals with early warning. It does not replace independent clinical judgment.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Amrita Hospital · NirikshAmrita Clinical Safety Engine.
          </div>
        </div>
      </footer>

      {/* ─── Loading Splash Overlay ─── */}
      {splashActive && (
        <div
          onClick={() => { setIsExiting(true); setTimeout(() => setSplashActive(false), 400); }}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transform transition-transform duration-1000 ease-[cubic-bezier(0.85,0,0.15,1)] cursor-pointer ${isExiting ? "translate-y-[-100%]" : "translate-y-0"}`}
          title="Click to enter"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-tr from-rose-50/50 via-white to-pink-50/50">
            <div className="absolute top-[40%] left-[50%] h-[550px] w-[550px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px] opacity-75 animate-[pulse_4s_infinite]" />
            <div className="absolute bottom-[-100px] left-[10%] h-[350px] w-[350px] rounded-full bg-accent/5 blur-[80px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-xl px-6">
            <div
              className="relative flex h-[300px] w-[300px] items-center justify-center bg-white rounded-[40px] p-6 shadow-elegant border border-primary/10 drop-shadow-[0_15px_30px_rgba(219,39,119,0.08)] overflow-hidden"
              style={{ animation: "floatLogo 4s ease-in-out infinite" }}
            >
              <img src={logoImg} className="h-full w-full object-contain rounded-[24px]" alt="NirikshAmrita Logo" />
            </div>
            <div className="space-y-3 mt-2">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/90 font-bold">Clinical Safety & Ward Surveillance</p>
              <div className="h-[2px] w-12 bg-primary/20 mx-auto rounded-full" />
              <p className="text-base font-medium text-primary leading-relaxed font-display max-w-sm mx-auto">
                "Watching every patient. Supporting every nurse. Protecting every life."
              </p>
            </div>
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
            @keyframes fillProgress { from { width: 0%; } to { width: 100%; } }
            @keyframes floatLogo { 0%, 100% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-12px) scale(1.03); } }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
        </div>
      )}
    </div>
  );
}