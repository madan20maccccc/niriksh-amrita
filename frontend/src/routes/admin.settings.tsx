import { createFileRoute } from "@tanstack/react-router";
import { Card, SectionHeader } from "@/components/ui/section";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" hint="Hospital configuration & alert thresholds" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-display text-lg text-foreground">Hospital details</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Hospital name" def="Amrita Hospital" />
            <Field label="Branch" def="Faridabad" />
            <Field label="Address" def="Sector 88, Faridabad" />
            <Field label="Helpdesk" def="+91 92054 92054" />
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-lg text-foreground">Alert thresholds</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="SpO₂ critical (<)" def="90" />
            <Field label="HR critical (>)" def="120" />
            <Field label="Systolic BP critical (>)" def="180" />
            <Field label="Resp. rate critical (>)" def="24" />
            <Field label="Sugar critical (>)" def="240" />
            <Field label="Temp critical (>)" def="101.5" />
          </div>
        </Card>
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display text-lg text-foreground">Change password</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Current password" type="password" />
            <Field label="New password" type="password" />
            <Field label="Confirm" type="password" />
          </div>
          <div className="mt-5 flex justify-end">
            <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant">Update password</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
function Field({ label, def, type = "text" }: { label: string; def?: string; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input type={type} defaultValue={def} className="mt-1.5 w-full rounded-xl border border-input bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" />
    </label>
  );
}