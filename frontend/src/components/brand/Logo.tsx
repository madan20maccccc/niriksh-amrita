import logoImg from "@/assets/logo_fina.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  tone?: "default" | "compact";
}

export function Logo({ size = 44, withWordmark = false, className, tone = "default" }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div 
        className="flex items-center justify-center overflow-hidden bg-transparent"
        style={{ width: size, height: size }}
      >
        <img src={logoImg} className="h-full w-full object-contain" alt="NirikshAmrita Logo" />
      </div>
      {withWordmark && (
        <div className="leading-tight">
          <div
            className={cn(
              "font-display font-bold text-foreground tracking-tight",
              tone === "compact" ? "text-lg" : "text-xl",
            )}
          >
            NurseWatch<span className="text-primary">AI</span>
          </div>
          {tone !== "compact" && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
              Amrita Hospital
            </div>
          )}
        </div>
      )}
    </div>
  );
}