import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useRef, type ComponentType } from "react";
import { Bell, ChevronLeft, LogOut, Menu, Search, User } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { clearSession, getSession, type Role } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getAlerts } from "@/lib/api";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export function AppShell({
  role,
  nav,
  title,
}: {
  role: Role;
  nav: NavItem[];
  title: string;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [session, setS] = useState<ReturnType<typeof getSession>>(null);
  const [open, setOpen] = useState(false);

  const seenAlertsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef<boolean>(true);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [activeAlarm, setActiveAlarm] = useState<any>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== role) {
      navigate({ to: role === "admin" ? "/login/admin" : "/login/nurse" });
      return;
    }
    setS(s);
  }, [role, navigate]);

  // Play Medical double beep
  const playAlarmSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (delay: number, duration: number, freq = 980) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + delay + 0.02);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime + delay + duration - 0.02);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + delay + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + duration);
      };
      
      playBeep(0.0, 0.15, 1046.50); // C6 note
      playBeep(0.2, 0.15, 1046.50);
    } catch (err) {
      console.error("Clinical AudioContext alarm failed:", err);
    }
  };

  // Repeating alarm sound when activeAlarm is active
  useEffect(() => {
    if (activeAlarm) {
      playAlarmSound();
      alarmIntervalRef.current = setInterval(playAlarmSound, 2200);
      
      // Trigger physical hardware vibration
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }
    } else {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    }
    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
      }
    };
  }, [activeAlarm]);

  // Real-time Critical Alarm warning System
  useEffect(() => {
    if (!session) return;

    const checkLiveAlerts = async () => {
      try {
        const activeAlerts = await getAlerts(undefined, undefined, "active");
        
        if (isFirstLoadRef.current) {
          activeAlerts.forEach((a: any) => seenAlertsRef.current.add(a.id));
          isFirstLoadRef.current = false;
          return;
        }

        let newCriticalAlert: any = null;
        activeAlerts.forEach((alert: any) => {
          if (!seenAlertsRef.current.has(alert.id)) {
            seenAlertsRef.current.add(alert.id);
            
            if (alert.risk_level === "RED") {
              newCriticalAlert = alert;
              
              toast.error("⚠️ CRITICAL CLINICAL BREACH", {
                description: `${alert.message}`,
                duration: 10000,
                action: {
                  label: "Respond",
                  onClick: () => navigate({ to: `/nurse/patient/${alert.patient_id}` as never }),
                },
              });
            } else if (alert.risk_level === "ORANGE") {
              toast.warning("🟠 High Risk Alert", {
                description: `${alert.message}`,
                duration: 7000,
                action: {
                  label: "View",
                  onClick: () => navigate({ to: `/nurse/patient/${alert.patient_id}` as never }),
                },
              });
            }
          }
        });

        // Update badge count
        setActiveAlertCount(activeAlerts.length);

        if (newCriticalAlert) {
          setActiveAlarm(newCriticalAlert);
        }
      } catch (err) {
        console.error("Failed to fetch live alerts:", err);
      }
    };

    checkLiveAlerts();
    const interval = setInterval(checkLiveAlerts, 8000);
    return () => clearInterval(interval);
  }, [session, navigate]);


  const onLogout = () => {
    clearSession();
    navigate({ to: "/welcome" });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 -translate-x-full border-r border-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          open && "translate-x-0",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-sidebar-border px-5">
          <Link to="/welcome" className="flex items-center gap-2">
            <Logo size={52} withWordmark tone="compact" />
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
        <div className="px-3 py-2">
          <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {role === "admin" ? "Hospital Admin" : "Nurse Workspace"}
          </div>
          <nav className="space-y-1">
            {nav.map(item => {
              const active = pathname === item.to || (item.to !== `/${role}` && pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary",
                  )}
                >
                  <item.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="absolute inset-x-3 bottom-4">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl border border-sidebar-border bg-white px-3 py-2.5 text-sm text-foreground transition hover:bg-muted"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" /> Sign out
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
            <button className="lg:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">NirikshAmrita</div>
              <h1 className="truncate font-display text-lg text-foreground">{title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-input bg-white px-3 py-2 text-sm md:flex">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input placeholder="Search patients, wards, nurses…" className="w-56 bg-transparent outline-none" />
              </div>
              <button 
                onClick={() => navigate({ to: role === "admin" ? "/admin/alerts" : "/nurse/notifications" } as never)}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-white hover:bg-muted transition"
                title="View alerts"
              >
                <Bell className="h-4 w-4" />
                {activeAlertCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-critical)] text-[9px] font-bold text-white">
                    {activeAlertCount > 99 ? "99+" : activeAlertCount}
                  </span>
                )}
              </button>
              <div className="hidden items-center gap-3 rounded-xl border border-border bg-white px-3 py-1.5 md:flex">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{session?.name ?? "—"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {role === "admin" ? "Administrator" : `${session?.ward} · ${session?.shift}`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* 🚨 Full-Screen Clinical Pager / Critical Alert Overlay */}
      {activeAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0.12 0.05 20 / 0.85)", backdropFilter: "blur(12px)" }}>
          
          {/* Flashing Warning Panel */}
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 text-center border-2 border-red-500 shadow-2xl relative overflow-hidden animate-pulse-slow">
            
            {/* Warning Glow top bar */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-shimmer" />

            <div className="space-y-6">
              
              {/* Telemetry Icon */}
              <div className="relative h-20 w-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-red-200 animate-ping opacity-75" />
                <div className="relative h-20 w-20 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center">
                  <Hospital className="h-10 w-10 text-red-600 animate-bounce" />
                </div>
              </div>

              {/* Title */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-red-600 uppercase" style={{ fontFamily: "var(--font-display)" }}>
                  🚨 CRITICAL SURVEILLANCE ALARM
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Active Patient Deterioration Recorded in Ward
                </p>
              </div>

              {/* Patient Detail Block */}
              <div className="rounded-2xl bg-red-50/60 border border-red-100 p-5 text-left space-y-2">
                <div className="text-sm text-slate-700 flex justify-between">
                  <span className="font-semibold">Patient Name:</span>
                  <span className="font-bold text-slate-900">{activeAlarm.patient_name || "Patient Alert"}</span>
                </div>
                <div className="text-sm text-slate-700 flex justify-between">
                  <span className="font-semibold">Risk score:</span>
                  <span className="font-bold text-red-600 font-mono text-base">NEWS2 SCORE: {activeAlarm.details?.match(/\d+/)?.[0] || "Critical"}</span>
                </div>
                <div className="text-xs text-slate-500 font-medium leading-relaxed mt-2 pt-2 border-t border-red-100/50">
                  <span className="font-bold text-red-700">Diagnosis Details:</span> {activeAlarm.message}
                </div>
              </div>

              {/* Sound & vibration notice */}
              <p className="text-[11px] text-red-500 font-bold tracking-wider uppercase animate-pulse">
                🔊 Alarm Ringing & Device Vibrating
              </p>

              {/* Actions */}
              <button
                onClick={() => {
                  const patientId = activeAlarm.patient_id;
                  setActiveAlarm(null);
                  navigate({ to: role === "admin" ? `/admin/alerts` : `/nurse/patient/${patientId}` as never });
                }}
                className="w-full py-4 text-sm font-bold text-white rounded-2xl transition hover:scale-[1.01] active:scale-95 shadow-lg"
                style={{
                  background: "linear-gradient(135deg, oklch(0.20 0.04 258), oklch(0.32 0.06 258))",
                  boxShadow: "0 10px 25px oklch(0.20 0.04 258 / 0.40)"
                }}
              >
                Silence Alarm & Open Patient Chart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}