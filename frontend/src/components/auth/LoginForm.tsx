import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { setSession, type Role } from "@/lib/auth";
import { loginUser } from "@/lib/api";

export function LoginForm({ role }: { role: Role }) {
  const navigate = useNavigate();
  const isAdmin = role === "admin";
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState(isAdmin ? "admin@amritahospital.org" : "nurse1@amrita.org");
  const [password, setPassword] = useState("amrita123");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginUser(email, password);
      const userRole = res.user.role;
      
      if (isAdmin && userRole !== "admin" && userRole !== "doctor") {
        throw new Error("This account does not have administrator privileges.");
      }
      if (!isAdmin && userRole !== "nurse" && userRole !== "doctor") {
        throw new Error("This account is not registered as a nurse/clinician.");
      }
      
      setSession({
        role: userRole === "admin" ? "admin" : "nurse",
        name: res.user.full_name,
        email: res.user.email,
        employeeId: res.user.employee_id,
        ward: res.user.department || undefined,
      });
      
      if (userRole === "admin") {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/nurse" });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden gradient-soft lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link to="/welcome"><Logo size={40} withWordmark /></Link>
        <div>
          <div className="rounded-3xl border border-primary/15 bg-white/80 p-8 shadow-elegant backdrop-blur">
            <p className="font-display text-2xl text-foreground">
              {isAdmin
                ? "The hospital command center for safer wards."
                : "Your calm, clear workflow at the bedside."}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {isAdmin
                ? "Live ward risk, nurse coverage, alert trends and AI hospital insights in one place."
                : "Today's tasks, your patients, vitals entry and SBAR handover — designed with nurses for nurses."}
            </p>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {["Patients","Wards","Alerts"].map(k => (
              <div key={k} className="rounded-2xl border border-primary/10 bg-white/70 p-4 text-center backdrop-blur">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="mt-1 font-display text-xl text-primary">●</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Amrita Hospital · NirikshAmrita
        </p>
      </aside>

      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <Link to="/role" className="lg:hidden"><Logo size={36} withWordmark tone="compact" /></Link>
          <div className="mt-8 lg:mt-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/10">
              {isAdmin ? "Administrator" : "Nurse"} sign in
            </span>
            <h1 className="mt-4 font-display text-3xl text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your Amrita Hospital credentials to continue.
            </p>
          </div>
          {error && (
            <div className="mt-4 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive font-medium border border-destructive/20">
              {error}
            </div>
          )}
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-input bg-white px-3 focus-within:ring-2 focus-within:ring-primary/30">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-input bg-white px-3 focus-within:ring-2 focus-within:ring-primary/30">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  type={show ? "text" : "password"} required value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm outline-none"
                />
                <button type="button" onClick={() => setShow(s => !s)} className="text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-[color:var(--color-primary)]" />
                Remember me
              </label>
              <a className="font-medium text-primary hover:underline" href="#">Forgot password?</a>
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "Signing in to NirikshAmrita..." : "Sign in to NirikshAmrita"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Not an {isAdmin ? "admin" : "nurse"}?{" "}
              <Link to="/role" className="font-medium text-primary hover:underline">Choose another role</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}