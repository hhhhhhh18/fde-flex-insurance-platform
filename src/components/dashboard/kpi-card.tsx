import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

const TONE_STYLES: Record<Tone, { icon: string; value: string }> = {
  primary: { icon: "bg-primary-soft text-primary", value: "text-foreground" },
  success: { icon: "bg-success-soft text-success", value: "text-foreground" },
  warning: { icon: "bg-warning-soft text-warning", value: "text-foreground" },
  danger: { icon: "bg-danger-soft text-danger", value: "text-foreground" },
  info: { icon: "bg-info-soft text-info", value: "text-foreground" },
  neutral: { icon: "bg-surface-muted text-muted", value: "text-foreground" },
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  footer,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  footer?: React.ReactNode;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className={cn("mt-2 truncate text-2xl font-semibold tabular tracking-tight", styles.value)}>{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      {footer ? <div className="mt-3 border-t border-border pt-3 text-[11px] text-muted">{footer}</div> : null}
    </Card>
  );
}
