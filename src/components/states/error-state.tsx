import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ErrorState({
  title,
  description,
  detail,
  action,
}: {
  title: string;
  description: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-[#fecaca] bg-danger-soft/40 px-6 py-10 text-center">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-danger-soft">
          <AlertTriangle aria-hidden className="size-5 text-danger" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
          {detail ? (
            <p className="mt-2 rounded-md border border-border bg-surface px-3 py-2 font-mono text-[11px] text-muted">{detail}</p>
          ) : null}
        </div>
        {action}
      </div>
    </Card>
  );
}
