import { createFileRoute } from "@tanstack/react-router";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";

export const Route = createFileRoute("/nurse/tasks")({ component: TasksPage });

const tasks = [
  { t: "Morning vitals · ICU Bay 3", time: "07:30", tone: "warning" as const, status: "In progress" },
  { t: "Medication round", time: "09:00", tone: "info" as const, status: "Pending" },
  { t: "Wound dressing · Bed ICU-07", time: "10:00", tone: "info" as const, status: "Pending" },
  { t: "SBAR handover prep", time: "13:30", tone: "primary" as const, status: "Pending" },
  { t: "Evening vitals", time: "15:00", tone: "info" as const, status: "Scheduled" },
  { t: "Hand hygiene audit", time: "11:00", tone: "success" as const, status: "Done" },
];

function TasksPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Today's Tasks" hint="Your shift checklist" />
      <Card className="p-4">
        <ul className="divide-y divide-border">
          {tasks.map(t => (
            <li key={t.t} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" defaultChecked={t.status === "Done"} className="h-4 w-4 rounded border-input accent-[color:var(--color-primary)]" />
                <div>
                  <div className="text-sm font-medium text-foreground">{t.t}</div>
                  <div className="text-xs text-muted-foreground">{t.time}</div>
                </div>
              </div>
              <StatusPill tone={t.tone}>{t.status}</StatusPill>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}