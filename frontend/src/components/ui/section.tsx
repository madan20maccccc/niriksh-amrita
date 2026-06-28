import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card shadow-card", className)}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title, hint, action, className,
}: { title: string; hint?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div>
        <h2 className="font-display text-xl text-foreground">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label, value, hint, tone = "default",
}: {
  label: string; value: React.ReactNode; hint?: string;
  tone?: "default" | "primary" | "critical" | "warning" | "success" | "info";
}) {
  const toneRing: Record<string, string> = {
    default: "",
    primary: "ring-1 ring-primary/15",
    critical: "ring-1 ring-[color-mix(in_oklab,var(--color-critical)_25%,transparent)]",
    warning: "ring-1 ring-[color-mix(in_oklab,var(--color-warning)_25%,transparent)]",
    success: "ring-1 ring-[color-mix(in_oklab,var(--color-success)_25%,transparent)]",
    info: "ring-1 ring-[color-mix(in_oklab,var(--color-info)_25%,transparent)]",
  };
  const toneText: Record<string, string> = {
    default: "text-foreground",
    primary: "text-primary",
    critical: "text-[var(--color-critical)]",
    warning: "text-[var(--color-warning)]",
    success: "text-[var(--color-success)]",
    info: "text-[var(--color-info)]",
  };
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-card", toneRing[tone])}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-2 font-display text-3xl", toneText[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}