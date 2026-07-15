import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  MessageCircle, Key, CheckCircle2, AlertTriangle, Loader2,
  ExternalLink, Copy, RefreshCw, Shield, Eye, EyeOff,
  Smartphone, Send, Settings, Info, ChevronRight, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { getBaseUrl, testWhatsApp, saveWhatsAppConfig, getWhatsAppConfig, testSMS, saveSMSConfig, getSMSConfig } from "@/lib/api";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  // WhatsApp Config
  const [wpPhone,  setWpPhone]  = useState("");
  const [wpApikey, setWpApikey] = useState("");
  const [wpSaving, setWpSaving] = useState(false);
  const [wpTesting,setWpTesting]= useState(false);
  const [wpStatus, setWpStatus] = useState<"idle"|"ok"|"fail">("idle");
  const [showKey,  setShowKey]  = useState(false);
  const [wpConfigured, setWpConfigured] = useState(false);

  // SMS Twilio Config
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);
  const [smsStatus, setSmsStatus] = useState<"idle"|"ok"|"fail">("idle");
  const [smsConfigured, setSmsConfigured] = useState(false);

  // Gemini Key
  const [geminiKey,    setGeminiKey]    = useState("");
  const [geminiSaving, setGeminiSaving] = useState(false);

  // Backend URL
  const [backendUrl,    setBackendUrl]    = useState(getBaseUrl() || "http://localhost:8000");
  const [backendSaving, setBackendSaving] = useState(false);

  useEffect(() => {
    Promise.all([getWhatsAppConfig(), getSMSConfig()])
      .then(([wCfg, sCfg]) => {
        setWpConfigured(wCfg.configured);
        setSmsConfigured(sCfg.configured);
      })
      .catch(() => {});
  }, []);


  const handleSaveWhatsApp = async () => {
    if (!wpPhone || !wpApikey) { toast.error("Both phone number and API key are required."); return; }
    setWpSaving(true);
    try {
      await saveWhatsAppConfig(wpPhone, wpApikey);
      setWpConfigured(true);
      toast.success("WhatsApp configuration saved! Critical alerts will now go to +" + wpPhone);
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    } finally { setWpSaving(false); }
  };

  const handleTestWhatsApp = async () => {
    if (!wpPhone || !wpApikey) { toast.error("Enter phone and API key first."); return; }
    setWpTesting(true); setWpStatus("idle");
    try {
      const res = await testWhatsApp(wpPhone, wpApikey);
      if (res.success) {
        setWpStatus("ok");
        toast.success("Test message sent! Check your WhatsApp.");
      } else {
        setWpStatus("fail");
        toast.error("Failed: " + res.message);
      }
    } catch (e: any) {
      setWpStatus("fail");
      toast.error(e.message);
    } finally { setWpTesting(false); }
  };

  const handleSaveSMS = async () => {
    if (!twilioSid || !twilioToken || !twilioFrom) {
      toast.error("Account SID, Auth Token, and Sender number are all required.");
      return;
    }
    setSmsSaving(true);
    try {
      await saveSMSConfig(twilioSid, twilioToken, twilioFrom);
      setSmsConfigured(true);
      toast.success("SMS Configuration saved successfully!");
    } catch (e: any) {
      toast.error("Failed to save SMS config: " + e.message);
    } finally {
      setSmsSaving(false);
    }
  };

  const handleTestSMS = async () => {
    if (!smsPhone) {
      toast.error("Please enter a phone number to send the test SMS to.");
      return;
    }
    setSmsTesting(true);
    setSmsStatus("idle");
    try {
      const res = await testSMS(smsPhone, twilioSid, twilioToken, twilioFrom);
      if (res.success) {
        setSmsStatus("ok");
        toast.success(res.message || "Test SMS sent successfully!");
      } else {
        setSmsStatus("fail");
        toast.error("Failed: " + res.message);
      }
    } catch (e: any) {
      setSmsStatus("fail");
      toast.error(e.message || "Failed to connect to SMS API");
    } finally {
      setSmsTesting(false);
    }
  };


  const handleSaveGemini = async () => {
    if (!geminiKey) return;
    setGeminiSaving(true);
    try {
      // Write to backend .env via a dedicated endpoint (or just show instructions)
      const res = await fetch(`${getBaseUrl()}/auth/update-gemini-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("nirikshamrita.token")}` },
        body: JSON.stringify({ key: geminiKey }),
      });
      if (res.ok) toast.success("Gemini API key updated. Restart the backend to apply.");
      else toast.error("Could not save automatically. Paste the key manually in backend/.env");
    } catch {
      toast.info("Paste this key into backend/.env as GEMINI_API_KEY=... then restart the server.");
    } finally { setGeminiSaving(false); }
  };

  const handleSaveBackendUrl = () => {
    setBackendSaving(true);
    localStorage.setItem("nirikshamrita.backend_url", backendUrl);
    setTimeout(() => {
      setBackendSaving(false);
      toast.success("Backend URL saved. Refresh the page to apply.");
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
          <p className="text-xs text-slate-500 font-medium">Configure real alerts, AI services, and connectivity</p>
        </div>
      </div>

      {/* ─── GEMINI API KEY ───────────────────────────────────── */}
      <Section icon={<Key className="h-4.5 w-4.5" />} title="Gemini AI API Key" badge="Required for OCR & SBAR" badgeColor="amber">
        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800 font-medium">
                Your current API key is broken (401 error — service account deleted). Get a fresh free key:
              </div>
            </div>
            <div className="space-y-2 pl-6">
              {[
                { n: 1, text: "Go to ", link: "https://aistudio.google.com/app/apikey", linkText: "aistudio.google.com/app/apikey" },
                { n: 2, text: "Sign in with your Google account (same one used for the project)" },
                { n: 3, text: "Click 'Create API Key' → select any project → Copy the key" },
                { n: 4, text: "Paste it below ↓" },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-2 text-xs text-amber-800 font-medium">
                  <span className="h-5 w-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold shrink-0 text-[10px]">{step.n}</span>
                  <span>
                    {step.text}
                    {step.link && (
                      <a href={step.link} target="_blank" rel="noreferrer"
                        className="text-blue-600 font-bold underline inline-flex items-center gap-0.5">
                        {step.linkText} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Gemini API Key</label>
            <div className="relative">
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
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 font-medium flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
            <span>
              After pasting the key below, open <code className="bg-blue-100 px-1 rounded font-mono">D:\nursewatch-ai\backend\.env</code> in Notepad,
              replace the line <code className="bg-blue-100 px-1 rounded font-mono">GEMINI_API_KEY=...</code> with your new key, then restart the backend server.
            </span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard.writeText(`GEMINI_API_KEY=${geminiKey}`); toast.success("Copied! Paste into backend/.env"); }}
              disabled={!geminiKey}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition disabled:opacity-40">
              <Copy className="h-4 w-4" /> Copy for .env
            </button>
          </div>
        </div>
      </Section>

      {/* ─── WHATSAPP ALERTS ─────────────────────────────────── */}
      <Section icon={<MessageCircle className="h-4.5 w-4.5" />} title="Real WhatsApp Alerts" badge={wpConfigured ? "Configured ✓" : "Not Configured"} badgeColor={wpConfigured ? "green" : "slate"}>
        <div className="space-y-5">

          {/* Status banner */}
          {wpConfigured && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              WhatsApp alerts are ACTIVE. Every RED/ORANGE clinical alert will send a real WhatsApp to the duty doctor.
            </div>
          )}

          {/* Setup Instructions */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> One-Time Setup (30 seconds)
            </div>
            <div className="space-y-2">
              {[
                { step: "1", text: "On the duty doctor's WhatsApp, save this number: ", highlight: "+34 644 10 30 77", subtext: "(name it 'CallMeBot')" },
                { step: "2", text: "Send this exact message to that number: ", highlight: "I allow callmebot to send me messages" },
                { step: "3", text: "Within 2 minutes, you'll receive an API key reply" },
                { step: "4", text: "Enter the doctor's number + that API key below ↓" },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
                  <span className="h-5 w-5 rounded-full flex items-center justify-center font-bold shrink-0 text-[10px] text-white"
                    style={{ background: "oklch(0.45 0.22 258)" }}>{s.step}</span>
                  <div>
                    {s.text}
                    {s.highlight && (
                      <span className="font-bold text-slate-900 bg-slate-200 rounded px-1.5 py-0.5 font-mono ml-1">{s.highlight}</span>
                    )}
                    {s.subtext && <span className="text-slate-500 ml-1">{s.subtext}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Doctor's WhatsApp Number <span className="text-slate-400 normal-case">(with country code, no +)</span>
              </label>
              <input
                type="tel"
                placeholder="919876543210"
                value={wpPhone}
                onChange={e => setWpPhone(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-[11px] text-slate-400">Example: 919876543210 (India)</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">CallMeBot API Key</label>
              <input
                type="text"
                placeholder="123456"
                value={wpApikey}
                onChange={e => setWpApikey(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-[11px] text-slate-400">Received via WhatsApp after step 2</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleTestWhatsApp}
              disabled={wpTesting || !wpPhone || !wpApikey}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition hover:scale-[1.02] active:scale-95"
              style={{ background: "linear-gradient(135deg, oklch(0.56 0.19 195), oklch(0.52 0.18 185))" }}
            >
              {wpTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test Message
            </button>
            <button
              onClick={handleSaveWhatsApp}
              disabled={wpSaving || !wpPhone || !wpApikey}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition hover:scale-[1.02] active:scale-95"
              style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.52 0.20 268))" }}
            >
              {wpSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save & Activate
            </button>
            {wpStatus === "ok" && (
              <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Message sent!
              </div>
            )}
            {wpStatus === "fail" && (
              <div className="flex items-center gap-1.5 text-sm font-bold text-red-600">
                <AlertTriangle className="h-4 w-4" /> Failed — check number & key
              </div>
            )}
          </div>

          {/* What a real alert looks like */}
          <div className="rounded-2xl bg-slate-900 p-4 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview: What the duty doctor receives</div>
            <div className="text-sm text-green-300 font-mono whitespace-pre-wrap leading-relaxed">{`🔴 *CLINICAL ALERT — NirikshAmrita*
━━━━━━━━━━━━━━━━━━━━
👤 *Patient:* Priya Menon
🛏 *Bed:* A-03 | ICU
📊 *NEWS2 Score:* 8 — *RED RISK*
⚠️ *Alert:* Respiratory rate critically elevated, SpO₂ falling
━━━━━━━━━━━━━━━━━━━━
Immediate clinical review required.
_— Amrita Hospital Surveillance System_`}</div>
          </div>
        </div>
      </Section>

      {/* ─── SMS ALERTS ───────────────────────────────────────── */}
      <Section icon={<Smartphone className="h-4.5 w-4.5" />} title="Real SMS Text Alerts" badge={smsConfigured ? "Configured ✓" : "Fallback (Textbelt)"} badgeColor={smsConfigured ? "green" : "amber"}>
        <div className="space-y-5">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800 font-medium">
                Choose your SMS Delivery Gateway:
              </div>
            </div>
            <p className="text-xs text-amber-700 pl-6 leading-relaxed">
              - <strong>Textbelt Gateway (Default):</strong> Zero setup, totally free. Sends <strong>1 free carrier SMS text message per day</strong> directly to any phone. Great for quick testing!
              <br/>- <strong>Twilio Gateway (Production):</strong> Register a Twilio account and configure below to send unlimited SMS alerts directly.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Twilio Account SID</label>
              <input
                type="text"
                placeholder="AC..."
                value={twilioSid}
                onChange={e => setTwilioSid(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Twilio Auth Token</label>
              <input
                type="password"
                placeholder="Token"
                value={twilioToken}
                onChange={e => setTwilioToken(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Twilio From Number</label>
              <input
                type="text"
                placeholder="+1234567890"
                value={twilioFrom}
                onChange={e => setTwilioFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Send Test SMS Text Message</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 919876543210 (include country code)"
                value={smsPhone}
                onChange={e => setSmsPhone(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                onClick={handleTestSMS}
                disabled={smsTesting || !smsPhone}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, oklch(0.56 0.19 195), oklch(0.52 0.18 185))" }}
              >
                {smsTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Test SMS
              </button>
            </div>
            {smsStatus === "ok" && (
              <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> SMS text alert dispatched successfully! Check your native Messages app.
              </p>
            )}
            {smsStatus === "fail" && (
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> SMS dispatch failed (check Twilio keys, daily limit, or verify number format).
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveSMS}
              disabled={smsSaving || !twilioSid || !twilioToken || !twilioFrom}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98] transition"
              style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.52 0.20 268))" }}
            >
              {smsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save & Activate Twilio Gateway
            </button>
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

      {/* ─── SECURITY NOTE ───────────────────────────────────── */}
      <Section icon={<Shield className="h-4.5 w-4.5" />} title="Security & Admin Guide" badge="Info" badgeColor="slate">
        <div className="space-y-3 text-sm text-slate-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: "Nurse Login Flow", desc: "Admin creates nurse accounts from the Nurses tab. Share the email + temp password with the nurse. They log in and immediately use the app." },
              { title: "Patient Admission", desc: "Admin or nurse goes to Patients tab → Admit Patient. Fill in real patient details. The assigned nurse sees them immediately in their dashboard." },
              { title: "WhatsApp Escalation", desc: "When any patient's NEWS2 score hits ORANGE (5+) or RED (7+), a real WhatsApp alert fires to the configured duty doctor automatically." },
              { title: "SBAR Translation", desc: "From any patient's SBAR page, click a language button to translate the AI-generated handover note to Malayalam, Telugu, Hindi etc." },
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