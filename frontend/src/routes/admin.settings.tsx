import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  MessageCircle, Key, CheckCircle2, AlertTriangle, Loader2,
  ExternalLink, Copy, RefreshCw, Shield, Eye, EyeOff,
  Smartphone, Send, Settings, Info, ChevronRight, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { getBaseUrl, testWhatsApp, saveWhatsAppConfig, getWhatsAppConfig, testSMS, saveSMSConfig, getSMSConfig, getTelegramConfig, saveTelegramConfig, testTelegram, discoverTelegramChats } from "@/lib/api";

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

  // Telegram Config (FREE & UNLIMITED)
  const [tgToken, setTgToken] = useState("");
  const [tgChatIds, setTgChatIds] = useState("");
  const [tgSaving, setTgSaving] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgStatus, setTgStatus] = useState<"idle"|"ok"|"fail">("idle");
  const [tgConfigured, setTgConfigured] = useState(false);
  const [tgDiscovering, setTgDiscovering] = useState(false);

  // Gemini Key
  const [geminiKey,    setGeminiKey]    = useState("");
  const [geminiSaving, setGeminiSaving] = useState(false);

  // Backend URL
  const [backendUrl,    setBackendUrl]    = useState(getBaseUrl() || "http://localhost:8000");
  const [backendSaving, setBackendSaving] = useState(false);

  useEffect(() => {
    Promise.all([getWhatsAppConfig(), getSMSConfig(), getTelegramConfig()])
      .then(([wCfg, sCfg, tCfg]) => {
        setWpConfigured(wCfg.configured);
        setSmsConfigured(sCfg.configured);
        setTgConfigured(tCfg.configured);
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

  const handleSaveTelegram = async () => {
    if (!tgToken || !tgChatIds) {
      toast.error("Both Bot Token and Chat IDs are required.");
      return;
    }
    setTgSaving(true);
    try {
      await saveTelegramConfig(tgToken, tgChatIds);
      setTgConfigured(true);
      toast.success("Telegram Bot configuration saved successfully!");
    } catch (e: any) {
      toast.error("Failed to save Telegram config: " + e.message);
    } finally {
      setTgSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!tgChatIds) {
      toast.error("Please enter a Chat ID to send the test alert to.");
      return;
    }
    setTgTesting(true);
    setTgStatus("idle");
    try {
      // Use first chat ID for the test
      const primaryChatId = tgChatIds.split(",")[0].trim();
      const res = await testTelegram(primaryChatId, tgToken);
      if (res.success) {
        setTgStatus("ok");
        toast.success("Test message sent! Check your Telegram chat.");
      } else {
        setTgStatus("fail");
        toast.error("Failed: " + res.message);
      }
    } catch (e: any) {
      setTgStatus("fail");
      toast.error(e.message || "Failed to send Telegram test message");
    } finally {
      setTgTesting(false);
    }
  };

  const handleDiscoverChats = async () => {
    if (!tgToken) {
      toast.error("Please enter your Telegram Bot Token first to fetch updates.");
      return;
    }
    setTgDiscovering(true);
    try {
      const res = await discoverTelegramChats(tgToken);
      if (res.success && res.chat_ids && res.chat_ids.length > 0) {
        const foundIds = res.chat_ids.join(", ");
        setTgChatIds(foundIds);
        toast.success(`Successfully discovered ${res.chat_ids.length} active Chat ID(s)! Saved into field.`);
      } else {
        toast.info(res.message || "No new users detected. Make sure you opened the bot and clicked 'START' first!");
      }
    } catch (e: any) {
      toast.error("Failed to fetch Telegram updates: " + e.message);
    } finally {
      setTgDiscovering(false);
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

      {/* ─── AUTO SMS STATUS BANNER ─────────────────────────────── */}
      <div className="rounded-3xl border-2 p-6 space-y-4"
        style={{ background: "linear-gradient(135deg, oklch(0.97 0.02 148), oklch(0.96 0.02 155))", borderColor: "oklch(0.78 0.14 148)" }}>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.45 0.20 148), oklch(0.50 0.18 155))" }}>
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">Automatic SMS to Doctor's Phone — HOW IT WORKS</div>
            <div className="text-sm text-slate-600 mt-0.5">When a nurse records critical vitals, SMS fires automatically. Doctor receives it in native Messages app — beep + vibration.</div>
          </div>
        </div>

        {/* How it works steps */}
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { step: "1", icon: "🌐", title: "Sign up at fast2sms.com", desc: "FREE • No credit card • Takes 2 minutes • Indian website" },
            { step: "2", icon: "🔑", title: "Copy your API Key", desc: "Dashboard → Dev API → Copy Authorization key" },
            { step: "3", icon: "✅", title: "Paste below & Save", desc: "SMS fires AUTOMATICALLY. No clicking needed ever again!" },
          ].map(s => (
            <div key={s.step} className="rounded-2xl bg-white/70 border border-emerald-200 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: "oklch(0.45 0.20 148)" }}>{s.step}</span>
                <div className="text-sm font-bold text-slate-800">{s.icon} {s.title}</div>
              </div>
              <div className="text-xs text-slate-600 pl-8">{s.desc}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-emerald-900/10 border border-emerald-300 p-3 flex items-start gap-2 text-xs text-emerald-900 font-medium">
          <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700" />
          <span>
            <strong>Once configured:</strong> SMS fires immediately when RED/ORANGE vitals are submitted.
            Also fires <strong>automatically every 15 minutes</strong> until the doctor acknowledges the alert.
            Doctor does NOT need any app — just their regular phone number!
          </span>
        </div>

        <a href="https://fast2sms.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-white rounded-2xl transition hover:scale-[1.01] active:scale-95"
          style={{ background: "linear-gradient(135deg, oklch(0.45 0.20 148), oklch(0.50 0.18 155))" }}>
          Open fast2sms.com to sign up FREE →
        </a>
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

      {/* ─── FREE SMS ALERTS (Fast2SMS) ──────────────────────── */}
      <Section icon={<Smartphone className="h-4.5 w-4.5" />} title="Free SMS Text Alerts (India)" badge={smsConfigured ? "Active" : "Setup Required"} badgeColor={smsConfigured ? "green" : "amber"}>
        <div className="space-y-5">
          {/* How it works */}
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
              <div className="text-sm text-emerald-800 font-bold">
                100% FREE SMS — Works like Jio / Bank messages!
              </div>
            </div>
            <p className="text-xs text-emerald-700 pl-6 leading-relaxed">
              Uses <strong>Fast2SMS</strong> (Indian free SMS gateway). You get <strong>~200+ free SMS messages</strong> on signup.
              Messages arrive in the doctor's native <strong>Messages app</strong> with the default phone <strong>beep and vibration</strong> — exactly like bank OTP or Jio recharge messages!
            </p>
            <div className="pl-6 space-y-1.5">
              {[
                { step: "1", text: "Go to ", highlight: "fast2sms.com", subtext: " and sign up free (use Google login)" },
                { step: "2", text: "Go to Dashboard → Dev API → Copy your ", highlight: "API Authorization Key" },
                { step: "3", text: "Paste it below and click Save!" },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-2 text-xs text-emerald-800 font-medium">
                  <span className="h-5 w-5 rounded-full flex items-center justify-center font-bold shrink-0 text-[10px] text-white"
                    style={{ background: "oklch(0.45 0.18 155)" }}>{s.step}</span>
                  <div>
                    {s.text}
                    {s.highlight && (
                      <span className="font-bold text-emerald-900 bg-emerald-100 rounded px-1.5 py-0.5 font-mono ml-0.5">{s.highlight}</span>
                    )}
                    {s.subtext && <span className="text-emerald-600">{s.subtext}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Key input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fast2SMS API Key</label>
            <input
              type="text"
              placeholder="Paste your Fast2SMS API key here..."
              value={smsPhone ? twilioSid : twilioSid}
              onChange={e => setTwilioSid(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="text-[11px] text-slate-400">Found at: fast2sms.com → Dashboard → Dev API</p>
          </div>

          {/* Save button */}
          <button
            onClick={async () => {
              if (!twilioSid) { toast.error("Paste your Fast2SMS API key first."); return; }
              setSmsSaving(true);
              try {
                const { saveFast2SMSConfig } = await import("@/lib/api");
                const res = await saveFast2SMSConfig(twilioSid);
                if (res.success) {
                  setSmsConfigured(true);
                  toast.success("Fast2SMS saved! Free SMS alerts are now active.");
                } else {
                  toast.error(res.message || "Failed to save.");
                }
              } catch (e: any) { toast.error(e.message); }
              finally { setSmsSaving(false); }
            }}
            disabled={smsSaving || !twilioSid}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98] transition"
            style={{ background: "linear-gradient(135deg, oklch(0.45 0.18 155), oklch(0.50 0.16 165))" }}
          >
            {smsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Fast2SMS Key
          </button>

          {/* Test SMS */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Send a Test SMS to Your Phone</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 10-digit Indian mobile number (e.g. 9876543210)"
                value={smsPhone}
                onChange={e => setSmsPhone(e.target.value.replace(/\D/g, ""))}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                onClick={async () => {
                  if (!smsPhone) { toast.error("Enter your phone number."); return; }
                  setSmsTesting(true); setSmsStatus("idle");
                  try {
                    const { testFast2SMS } = await import("@/lib/api");
                    const res = await testFast2SMS(smsPhone, twilioSid);
                    if (res.success) { setSmsStatus("ok"); toast.success("SMS sent! Check your Messages app."); }
                    else { setSmsStatus("fail"); toast.error(res.message || "SMS failed."); }
                  } catch (e: any) { setSmsStatus("fail"); toast.error(e.message); }
                  finally { setSmsTesting(false); }
                }}
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
                <CheckCircle2 className="h-3.5 w-3.5" /> SMS sent! Check your phone's Messages app.
              </p>
            )}
            {smsStatus === "fail" && (
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> SMS failed — check API key and phone number format.
              </p>
            )}
          </div>

          {/* Auto-alert info */}
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 font-medium flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
            <span>
              <strong>Automatic alerts:</strong> When Fast2SMS is active and a ward has a doctor phone number configured,
              SMS alerts fire <strong>immediately</strong> on critical vitals AND <strong>every 15 minutes</strong> for all unacknowledged RED/ORANGE patients.
              Set doctor phone numbers in the <strong>Wards</strong> tab.
            </span>
          </div>
        </div>
      </Section>

      {/* ─── FREE & UNLIMITED TELEGRAM ALERTS ─────────────────── */}
      <Section icon={<MessageCircle className="h-4.5 w-4.5" />} title="Free Telegram Bot Alerts" badge={tgConfigured ? "Active ✓" : "Setup Required"} badgeColor={tgConfigured ? "green" : "amber"}>
        <div className="space-y-5">
          {/* Guide */}
          <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-sky-700 mt-0.5 shrink-0" />
              <div className="text-sm text-sky-800 font-bold">
                100% FREE FOREVER — Unlimited Clinical Alerts!
              </div>
            </div>
            <p className="text-xs text-sky-700 pl-6 leading-relaxed">
              No subscription, no paid keys, no daily limits! Alerts arrive instantly on the doctor's phone with sound and vibration.
            </p>
            <div className="pl-6 space-y-1.5">
              {[
                { step: "1", text: "Open Telegram, search for ", highlight: "@BotFather", subtext: " and send /newbot to create a bot. Copy the API Token." },
                { step: "2", text: "Paste the Bot Token below." },
                { step: "3", text: "Open your new bot link on your phone and click ", highlight: "START", subtext: " (essential to activate!)." },
                { step: "4", text: "Click ", highlight: "Auto-Discover Chat IDs", subtext: " below to instantly find your doctor's Chat ID!" }
              ].map(s => (
                <div key={s.step} className="flex items-start gap-2 text-xs text-sky-800 font-medium">
                  <span className="h-5 w-5 rounded-full flex items-center justify-center font-bold shrink-0 text-[10px] text-white"
                    style={{ background: "oklch(0.55 0.16 240)" }}>{s.step}</span>
                  <div>
                    {s.text}
                    {s.highlight && (
                      <span className="font-bold text-sky-900 bg-sky-100 rounded px-1.5 py-0.5 font-mono ml-0.5">{s.highlight}</span>
                    )}
                    {s.subtext && <span className="text-sky-600 ml-0.5">{s.subtext}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Token & Chat IDs inputs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Telegram Bot Token</label>
              <input
                type="text"
                placeholder="123456:ABC-DEF..."
                value={tgToken}
                onChange={e => setTgToken(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-[11px] text-slate-400">Example: 7123456789:AAH_abcdef...</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doctor Chat IDs (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. 987654321"
                value={tgChatIds}
                onChange={e => setTgChatIds(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-[11px] text-slate-400">Multiple chat IDs can be entered, separated by commas.</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              onClick={handleSaveTelegram}
              disabled={tgSaving || !tgToken || !tgChatIds}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98] transition"
              style={{ background: "linear-gradient(135deg, oklch(0.45 0.22 258), oklch(0.52 0.20 268))" }}
            >
              {tgSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Bot Config
            </button>
            
            <button
              onClick={handleDiscoverChats}
              disabled={tgDiscovering || !tgToken}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-200 transition"
            >
              {tgDiscovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Auto-Discover Chat IDs
            </button>

            <button
              onClick={handleTestTelegram}
              disabled={tgTesting || !tgChatIds || !tgToken}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-slate-900 rounded-xl disabled:opacity-50 hover:bg-slate-800 transition"
            >
              {tgTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test Telegram
            </button>

            {tgStatus === "ok" && (
              <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Sent!
              </span>
            )}
            {tgStatus === "fail" && (
              <span className="flex items-center gap-1.5 text-sm font-bold text-red-600">
                <AlertTriangle className="h-4 w-4" /> Failed.
              </span>
            )}
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