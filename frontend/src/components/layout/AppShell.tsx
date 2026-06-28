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

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== role) {
      navigate({ to: role === "admin" ? "/login/admin" : "/login/nurse" });
      return;
    }
    setS(s);
  }, [role, navigate]);

  // Real-time Critical Alarm warning System
  useEffect(() => {
    if (!session) return;

    const playAlarmSound = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playBeep = (delay: number, duration: number, freq = 880) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
          
          gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
          gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + delay + 0.02);
          gain.gain.setValueAtTime(0.4, audioCtx.currentTime + delay + duration - 0.02);
          gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + delay + duration);
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.start(audioCtx.currentTime + delay);
          osc.stop(audioCtx.currentTime + delay + duration);
        };
        
        // Medical telemetry warning: double beep
        playBeep(0.0, 0.12, 987.77); // B5 note
        playBeep(0.18, 0.12, 987.77);
      } catch (err) {
        console.error("Clinical AudioContext alarm failed to start:", err);
      }
    };

    const checkLiveAlerts = async () => {
      try {
        // Query active alerts
        const activeAlerts = await getAlerts(undefined, undefined, "active");
        
        if (isFirstLoadRef.current) {
          // Initialize seenAlerts with pre-existing database alerts on first load
          activeAlerts.forEach((a: any) => seenAlertsRef.current.add(a.id));
          isFirstLoadRef.current = false;
          return;
        }

        // Check for newly triggered critical RED alerts
        let triggeredAlarm = false;
        activeAlerts.forEach((alert: any) => {
          if (!seenAlertsRef.current.has(alert.id)) {
            seenAlertsRef.current.add(alert.id);
            
            // Only trigger alarm sound and toast for RED (critical) risk alerts
            if (alert.risk_level === "RED") {
              triggeredAlarm = true;
              
              toast.error("⚠️ CRITICAL CLINICAL BREACH", {
                description: `${alert.message}`,
                duration: 10000,
                action: {
                  label: "Respond",
                  onClick: () => navigate({ to: `/nurse/patient/${alert.patient_id}` as never }),
                },
              });
            } else if (alert.risk_level === "ORANGE") {
              // Also show toast for ORANGE but without alarm
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

        if (triggeredAlarm) {
          playAlarmSound();
        }
      } catch (err) {
        console.error("Failed to fetch live alerts:", err);
      }
    };

    // Check immediately, then poll every 8 seconds
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
    </div>
  );
}