import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Stethoscope, ChevronRight, Settings2, Link2, Wifi, WifiOff, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/role")({
  head: () => ({
    meta: [
      { title: "Choose your role — NirikshAmrita" },
      { name: "description", content: "Sign in as Administrator or Nurse." },
    ],
  }),
  component: RolePage,
});

function ConnectionSettings() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"checking" | "connected" | "offline" | "default">("default");

  const checkStatus = async (backendUrl: string) => {
    if (!backendUrl) {
      setStatus("default");
      return;
    }
    setStatus("checking");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      // Attempt to hit status/login endpoint to verify connection
      const res = await fetch(`${backendUrl.replace(/\/+$/, "")}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@test.com", password: "test" }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      setStatus("connected");
    } catch (e) {
      setStatus("offline");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nirikshamrita.backend_url") || "";
      setUrl(stored);
      if (stored) {
        checkStatus(stored);
      }
    }
  }, []);

  const handleSave = () => {
    if (url.trim()) {
      localStorage.setItem("nirikshamrita.backend_url", url.trim());
      checkStatus(url.trim());
    } else {
      localStorage.removeItem("nirikshamrita.backend_url");
      setStatus("default");
    }
    setOpen(false);
    window.location.reload();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold hover:bg-muted transition shadow-sm cursor-pointer"
        title="Remote Server Connection Settings"
      >
        <Settings2 className="h-3.5 w-3.5 text-primary" />
        <span>Tunnel Config</span>
        {status === "connected" && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
        {status === "offline" && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elegant animate-in zoom-in-95 text-left">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" /> Remote Server Settings
              </h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="mt-4 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect this interface to a public backend tunnel URL (e.g. <code>ngrok</code> or <code>localtunnel</code>) if your backend is running on a different computer/Wi-Fi network.
              </p>
              
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Backend Tunnel URL:
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://your-backend.loca.lt"
                  className="w-full rounded-xl border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-border text-xs flex items-center justify-between">
                <div className="font-semibold text-muted-foreground">Status:</div>
                <div className="flex items-center gap-1.5">
                  {status === "default" && (
                    <span className="text-foreground font-medium flex items-center gap-1">
                      <Wifi className="h-3.5 w-3.5 text-blue-500" /> Default (Localhost:8000)
                    </span>
                  )}
                  {status === "checking" && (
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <span className="h-3 w-3 border-2 border-primary border-t-transparent animate-spin rounded-full" /> Checking...
                    </span>
                  )}
                  {status === "connected" && (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <Wifi className="h-3.5 w-3.5 animate-pulse" /> Connected to Tunnel
                    </span>
                  )}
                  {status === "offline" && (
                    <span className="text-red-500 font-medium flex items-center gap-1">
                      <WifiOff className="h-3.5 w-3.5 animate-pulse" /> Connection Failed
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => { setUrl(""); localStorage.removeItem("nirikshamrita.backend_url"); window.location.reload(); }}
                className="rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-semibold hover:bg-muted cursor-pointer"
              >
                Reset to Local
              </button>
              <button
                onClick={handleSave}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-elegant hover:opacity-95 cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RolePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary-soft/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/welcome"><Logo size={36} withWordmark tone="compact" /></Link>
        <div className="flex items-center gap-3">
          <ConnectionSettings />
          <Link to="/welcome" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center">
          <h1 className="font-display text-4xl text-foreground">Who's signing in?</h1>
          <p className="mt-3 text-muted-foreground">
            NirikshAmrita is used by hospital administrators and bedside nursing teams.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[
            { to: "/login/admin", icon: Shield, title: "Administrator", body: "Hospital command center, ward management, nurse and patient administration, reports and alerts oversight." },
            { to: "/login/nurse", icon: Stethoscope, title: "Nurse", body: "Ward-level workflow: my patients, vitals entry, AI summaries, SBAR handover and shift tasks." },
          ].map(c => (
            <Link
              key={c.to}
              to={c.to}
              className="group relative overflow-hidden rounded-3xl border border-border bg-white p-8 shadow-card transition hover:shadow-elegant"
            >
              <div className="absolute inset-x-0 top-0 h-1 gradient-primary" />
              <div className="flex items-center justify-between">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <c.icon className="h-7 w-7" />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h2 className="mt-6 font-display text-2xl text-foreground">{c.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}