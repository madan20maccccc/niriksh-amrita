import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Key, CheckCircle2, AlertTriangle, Loader2,
  ExternalLink, Copy, RefreshCw, Shield, Eye, EyeOff,
  Mail, Send, Settings, Info, ChevronRight, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { getBaseUrl, getAIConfig, saveHFToken, saveAIProvider } from "@/lib/api";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  // Gemini Key
  const [geminiKey,    setGeminiKey]    = useState("");
  const [geminiSaving, setGeminiSaving] = useState(false);
  const [showKey,      setShowKey]      = useState(false);

  // Hugging Face Config
  const [hfToken,        setHfToken]        = useState("");
  const [hfSaving,       setHfSaving]       = useState(false);
  const [aiProvider,     setAiProvider]     = useState("huggingface");
  const [providerSaving, setProviderSaving] = useState(false);

  // Email Alert Config
  const [doctorEmail,  setDoctorEmail]  = useState("madan.m200607@gmail.com");
  const [smtpUser,     setSmtpUser]     = useState("");
  const [smtpPass,     setSmtpPass]     = useState("");
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [emailSaving,  setEmailSaving]  = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailStatus,  setEmailStatus]  = useState<"idle"|"ok"|"fail">("idle");

  // Backend URL
  const [backendUrl,    setBackendUrl]    = useState(getBaseUrl() || "http://localhost:8000");
  const [backendSaving, setBackendSaving] = useState(false);

  useEffect(() => {
    getAIConfig()
      .then((aiCfg) => {
        if (aiCfg) {
          setGeminiKey(aiCfg.gemini_api_key || "");
          setHfToken(aiCfg.huggingface_api_key || "");
          setAiProvider(aiCfg.ai_provider || "huggingface");
        }
      })
      .catch(() => {});
    const savedEmail = localStorage.getItem("nirikshamrita.doctor_email");
    const savedSmtp  = localStorage.getItem("nirikshamrita.smtp_user");
    if (savedEmail) setDoctorEmail(savedEmail);
    if (savedSmtp)  setSmtpUser(savedSmtp);
  }, []);

  const handleSaveGemini = async () => {
    if (!geminiKey) return;
    setGeminiSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/update-gemini-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("nirikshamrita.token")}` },
        body: JSON.stringify({ key: geminiKey }),
      });
      if (res.ok) toast.success("Gemini API key updated successfully!");
      else toast.error("Could not save. Paste the key manually in backend/.env");
    } catch {
      toast.info("Paste this key into backend/.env as GEMINI_API_KEY=... then restart the server.");
    } finally { setGeminiSaving(false); }
  };

  const handleSaveHFToken = async () => {
    if (!hfToken) return;
    setHfSaving(true);
    try {
      await saveHFToken(hfToken);
      toast.success("Hugging Face API token saved and activated!");
    } catch (e: any) {
      toast.error("Failed to save HF token: " + e.message);
    } finally { setHfSaving(false); }
  };

  const handleSaveProvider = async (provider: string) => {
    setProviderSaving(true);
    try {
      await saveAIProvider(provider);
      setAiProvider(provider);
      toast.success(`AI provider switched to ${provider === "gemini" ? "Google Gemini" : "Hugging Face (Free)"}!`);
    } catch (e: any) {
      toast.error("Failed to switch AI provider: " + e.message);
    } finally { setProviderSaving(false); }
  };

  const handleSaveEmailConfig = async () => {
    if (!doctorEmail) { toast.error("Doctor email address is required."); return; }
    setEmailSaving(true);
    try {
      const token = localStorage.getItem("nirikshamrita.token");
      const res = await fetch(`${getBaseUrl()}/auth/update-email-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ doctor_email: doctorEmail, smtp_user: smtpUser, smtp_pass: smtpPass }),
      });
      localStorage.setItem("nirikshamrita.doctor_email", doctorEmail);
      if (smtpUser) localStorage.setItem("nirikshamrita.smtp_user", smtpUser);
      if (res.ok) {
        toast.success(`Email config saved! Alerts will go to ${doctorEmail}`);
      } else {
        toast.success(`Doctor email saved locally. Add SMTP_USER/SMTP_PASS to backend/.env for live emails.`);
      }
    } catch {
      localStorage.setItem("nirikshamrita.doctor_email", doctorEmail);
      toast.success(`Doctor email saved to ${doctorEmail}. Alerts are logged — add SMTP creds for live delivery.`);
    } finally { setEmailSaving(false); }
  };

  const handleTestEmail = async () => {
    setEmailTesting(true); setEmailStatus("idle");
    try {
      const token = localStorage.getItem("nirikshamrita.token");
      const res = await fetch(`${getBaseUrl()}/auth/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to_email: doctorEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailStatus("ok");
        toast.success(data.simulated
          ? "Email test logged (SMTP not yet configured). Add SMTP creds below for live delivery."
          : "Test email sent to " + doctorEmail
        );
      } else {
        setEmailStatus("fail");
        toast.error("Email failed: " + (data.message || "Unknown error"));
      }
    } catch (e: any) {
      setEmailStatus("fail");
      toast.error("Could not reach backend: " + e.message);
    } finally { setEmailTesting(false); }
  };

  const handleSaveBackendUrl = () => {
    setBackendSaving(true);
    localStorage.setItem("nirikshamrita.backend_url", backendUrl);
    setTimeout(() => {
      setBackendSaving(false);
      toast.success("Backend URL saved. Refresh to apply.");
    }, 600);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))" }}>
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>System Configuration</h2>
          <p className="text-xs text-slate-500 font-medium">Configure AI services, email alerts, and connectivity</p>
        </div>
      </div>

      {/* ─── EMAIL ALERTS ─────────────────────────────────────── */}
      <Section icon={<Mail className="h-4.5 w-4.5" />} title="Doctor Email Alerts" badge="Free • No API Required" badgeColor="green">
        <div className="space-y-5">

          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
              <div className="text-sm text-emerald-800 font-bold">Automated Email Alerts — 100% Free!</div>
            </div>
            <p className="text-xs text-emerald-700 pl-6 leading-relaxed">
              When a patient's NEWS2 score hits <strong>ORANGE (5+) or RED (7+)</strong>, an email is automatically sent to
              the doctor's inbox. No WhatsApp, no SMS credits, no subscriptions needed.
              Works with any Gmail account via free SMTP.
            </p>
          </div>

          {/* Doctor Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doctor's Email Address</label>
            <input
              type="email"
              placeholder="doctor@hospital.com"
              value={doctorEmail}
              onChange={e => setDoctorEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="text-[11px] text-slate-400">All critical alerts will be emailed here automatically.</p>
          </div>

          {/* SMTP Section */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Optional: Enable Live Email Delivery (Gmail SMTP)
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 font-medium flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
              <span>
                Without SMTP, alerts are <strong>logged locally</strong> in <code className="bg-blue-100 px-1 rounded">emails_sent_log.txt</code> — great for demos.
                To send <strong>real emails</strong>: Gmail → Settings → Security → 2FA → App Passwords → create "NirikshAmrita"
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gmail Address (SMTP_USER)</label>
                <input
                  type="email"
                  placeholder="yourgmail@gmail.com"
                  value={smtpUser}
                  onChange={e => setSmtpUser(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gmail App Password (SMTP_PASS)</label>
                <div className="relative">
                  <input
                    type={showSmtpPass ? "text" : "password"}
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={smtpPass}
                    onChange={e => setSmtpPass(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <button onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Or add manually to <code className="bg-slate-100 px-1 rounded font-mono">backend/.env</code>: SMTP_USER=... and SMTP_PASS=...
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleSaveEmailConfig}
              disabled={emailSaving || !doctorEmail}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98] transition"
              style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.52 0.20 268))" }}
            >
              {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Email Config
            </button>
            <button
              onClick={handleTestEmail}
              disabled={emailTesting || !doctorEmail}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition hover:scale-[1.02] active:scale-95"
              style={{ background: "linear-gradient(135deg, oklch(0.56 0.19 195), oklch(0.52 0.18 185))" }}
            >
              {emailTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test Email
            </button>
            {emailStatus === "ok" && (
              <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Email sent!
              </div>
            )}
            {emailStatus === "fail" && (
              <div className="flex items-center gap-1.5 text-sm font-bold text-red-600">
                <AlertTriangle className="h-4 w-4" /> Failed — check email
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-2xl bg-slate-900 p-4 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview: Email the doctor receives</div>
            <div className="text-sm text-green-300 font-mono whitespace-pre-wrap leading-relaxed">{`Subject: [CRITICAL ALERT] RED Risk - Priya Menon (Bed A-03)

🏥 NURSEWATCH AI - CLINICAL ALERT SYSTEM
===========================================
Patient: Priya Menon  |  Bed: A-03  |  Ward: ICU
NEWS2 Score: 8 — RED RISK
Alert: Respiratory rate critically elevated, SpO₂ falling

Immediate clinical review required.
— NirikshAmrita Hospital Alert System`}</div>
          </div>
        </div>
      </Section>

      {/* ─── AI PROVIDER CONFIG ────────────────────────────────── */}
      <Section icon={<Zap className="h-4.5 w-4.5" />} title="AI Provider Configuration" badge="SBAR • RAG • OCR" badgeColor="amber">
        <div className="space-y-5">

          {/* Provider Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active AI Provider</label>
            <div className="flex gap-2">
              {[
                { id: "huggingface", label: "🤗 Hugging Face (Free)", color: "oklch(0.45 0.18 155)" },
                { id: "gemini",      label: "✨ Google Gemini",       color: "oklch(0.45 0.22 258)" },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSaveProvider(p.id)}
                  disabled={providerSaving}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl transition"
                  style={aiProvider === p.id
                    ? { background: p.color, color: "white" }
                    : { background: "oklch(0.97 0 0)", color: "oklch(0.4 0 0)", border: "1px solid oklch(0.9 0 0)" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              {aiProvider === "huggingface"
                ? "Using Hugging Face (Llama 3.1 8B) — Free. Works for SBAR generation, translation & RAG."
                : "Using Google Gemini — requires a valid GEMINI_API_KEY below."}
            </p>
          </div>

          {/* Hugging Face Token */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hugging Face Token (Free)</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="hf_..."
                value={hfToken}
                onChange={e => setHfToken(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                onClick={handleSaveHFToken}
                disabled={hfSaving || !hfToken}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, oklch(0.45 0.18 155), oklch(0.50 0.16 165))" }}
              >
                {hfSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Get a free token at{" "}
              <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer"
                className="text-blue-500 underline">huggingface.co/settings/tokens</a>
            </p>
          </div>

          {/* Gemini Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gemini API Key (Optional — for OCR)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="AIza..."
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={handleSaveGemini}
                disabled={geminiSaving || !geminiKey}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.52 0.20 268))" }}
              >
                {geminiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save
              </button>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { navigator.clipboard.writeText(`GEMINI_API_KEY=${geminiKey}`); toast.success("Copied! Paste into backend/.env"); }}
                disabled={!geminiKey}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition disabled:opacity-40">
                <Copy className="h-3.5 w-3.5" /> Copy for .env
              </button>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
                Get Free Key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── BACKEND URL ─────────────────────────────────────── */}
      <Section icon={<Zap className="h-4.5 w-4.5" />} title="Backend Server URL" badge="Connection" badgeColor="blue">
        <div className="space-y-3">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 font-medium flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
            <span>
              If you're running on a remote server or using ngrok/localtunnel, set the backend URL here.
              Default for local development: <code className="bg-blue-100 px-1 rounded font-mono">http://localhost:8000</code>
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={backendUrl}
              onChange={e => setBackendUrl(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="http://localhost:8000"
            />
            <button
              onClick={handleSaveBackendUrl}
              disabled={backendSaving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.52 0.20 268))" }}
            >
              {backendSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Save
            </button>
          </div>
        </div>
      </Section>

      {/* ─── ADMIN GUIDE ─────────────────────────────────────── */}
      <Section icon={<Shield className="h-4.5 w-4.5" />} title="Admin Guide" badge="Info" badgeColor="slate">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: "Nurse Login Flow",    desc: "Admin creates nurse accounts from the Nurses tab. Share the email + temp password with the nurse. They log in and use the app immediately." },
            { title: "Patient Admission",   desc: "Admin or nurse goes to Patients tab → Admit Patient. Fill in real patient details. The assigned nurse sees them immediately on their dashboard." },
            { title: "Email Escalation",    desc: "When any patient's NEWS2 hits ORANGE (5+) or RED (7+), an email fires to the doctor automatically. Re-sends every 15 min until acknowledged." },
            { title: "SBAR Translation",    desc: "From any patient's SBAR page, click a language button to translate the AI-generated handover note to Malayalam, Telugu, Hindi, Tamil, or Kannada." },
          ].map(i => (
            <div key={i.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{i.title}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{i.desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ icon, title, badge, badgeColor, children }: {
  icon: React.ReactNode; title: string; badge?: string; badgeColor?: string; children: React.ReactNode;
}) {
  const badgeColors: Record<string, string> = {
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    blue:  "bg-blue-100 text-blue-700 border-blue-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <div className="rounded-3xl bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.56 0.19 195))" }}>
            {icon}
          </div>
          <span className="text-sm font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>{title}</span>
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${badgeColors[badgeColor || "slate"]}`}>{badge}</span>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}