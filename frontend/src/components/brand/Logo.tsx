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
              "font-display font-bold tracking-tight text-white",
              tone === "compact" ? "text-lg" : "text-xl",
            )}
          >
            NurseWatch<span className="text-sky-400">AI</span>
          </div>
          {tone !== "compact" && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300 mt-0.5">
              Amrita School of AI
            </div>
          )}
        </div>
      )}
    </div>
  );
}