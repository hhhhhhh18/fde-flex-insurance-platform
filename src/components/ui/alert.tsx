import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "danger";

const STYLES: Record<Tone, { wrapper: string; icon: typeof Info }> = {
  info: { wrapper: "border-[#bae6fd] bg-info-soft text-info", icon: Info },
  success: { wrapper: "border-[#bbf7d0] bg-success-soft text-success", icon: CheckCircle2 },
  danger: { wrapper: "border-[#fecaca] bg-danger-soft text-danger", icon: AlertTriangle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const style = STYLES[tone];
  const Icon = style.icon;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-xs", style.wrapper, className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "leading-relaxed")}>{children}</div> : null}
      </div>
    </div>
  );
}
