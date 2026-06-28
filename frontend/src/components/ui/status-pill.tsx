import { cn } from "@/lib/utils";

type Tone = "critical" | "warning" | "success" | "info" | "muted" | "primary";

const map: Record<Tone, string> = {
  critical: "bg-[color-mix(in_oklab,var(--color-critical)_14%,transparent)] text-[var(--color-critical)] ring-1 ring-[color-mix(in_oklab,var(--color-critical)_30%,transparent)]",
  warning: "bg-[color-mix(in_oklab,var(--color-warning)_16%,transparent)] text-[color-mix(in_oklab,var(--color-warning)_70%,#7a4a00)] ring-1 ring-[color-mix(in_oklab,var(--color-warning)_30%,transparent)]",
  success: "bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] text-[var(--color-success)] ring-1 ring-[color-mix(in_oklab,var(--color-success)_30%,transparent)]",
  info: "bg-[color-mix(in_oklab,var(--color-info)_14%,transparent)] text-[var(--color-info)] ring-1 ring-[color-mix(in_oklab,var(--color-info)_30%,transparent)]",
  muted: "bg-muted text-muted-foreground ring-1 ring-border",
  primary: "bg-primary-soft text-primary ring-1 ring-primary/20",
};

export function StatusPill({
  tone = "muted",
  children,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const dotColor: Record<Tone, string> = {
    critical: "bg-[var(--color-critical)]",
    warning: "bg-[var(--color-warning)]",
    success: "bg-[var(--color-success)]",
    info: "bg-[var(--color-info)]",
    muted: "bg-muted-foreground",
    primary: "bg-primary",
  };
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      map[tone],
      className,
    )}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[tone])} />}
      {children}
    </span>
  );
}

export function riskTone(risk: string): Tone {
  if (risk === "Critical") return "critical";
  if (risk === "High") return "warning";
  if (risk === "Moderate") return "info";
  return "success";
}

export function severityTone(s: string): Tone {
  if (s === "Red") return "critical";
  if (s === "Orange") return "warning";
  return "info";
}