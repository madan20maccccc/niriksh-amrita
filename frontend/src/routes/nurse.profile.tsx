import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, User, Loader2 } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/section";
import { clearSession, getSession } from "@/lib/auth";
import { request } from "@/lib/api";

export const Route = createFileRoute("/nurse/profile")({ component: ProfilePage });

function ProfilePage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMe() {
      try {
        const data = await request("/auth/me");
        setMe(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load profile details.");
        // Fallback to session if API fails
        const s = getSession();
        if (s) {
          setMe({
            full_name: s.name,
            employee_id: s.employeeId,
            email: s.email,
            department: s.ward,
            phone: "N/A"
          });
        }
      } finally {
        setLoading(false);
      }
    }
    loadMe();
  }, []);

  const logout = () => { 
    clearSession(); 
    localStorage.removeItem("nirikshamrita.token");
    navigate({ to: "/welcome" }); 
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="My Profile" hint="Account and shift details" />
      
      {error && (
        <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-amber-800 text-sm">
          Warning: {error}. Displaying cached session details.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-6 text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary-soft text-primary">
            <User className="h-10 w-10" />
          </div>
          <h3 className="mt-4 font-display text-xl text-foreground font-semibold">{me?.full_name}</h3>
          <p className="text-sm text-muted-foreground">{me?.employee_id || "N/A"}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left text-sm">
            <KV k="Ward" v={me?.department || "General Ward"} />
            <KV k="Role" v={me?.role || "Nurse"} />
            <KV k="Email" v={me?.email || "N/A"} />
            <KV k="Phone" v={me?.phone || "N/A"} />
          </div>
          <button onClick={logout} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-lg text-foreground font-semibold">Change password</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Current password" type="password" />
            <Field label="New password" type="password" />
            <Field label="Confirm" type="password" />
          </div>
          <div className="mt-4 flex justify-end">
            <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95 transition">
              Update password
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{k}</div>
      <div className="text-sm font-medium text-foreground">{v}</div>
    </div>
  );
}

function Field({ label, type = "text" }: { label: string; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input type={type} className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" />
    </label>
  );
}