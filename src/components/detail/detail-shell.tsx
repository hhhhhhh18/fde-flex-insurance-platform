import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DetailHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  badges,
  actions,
}: {
  backHref: string;
  backLabel: string;
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {badges}
          </div>
          {subtitle ? <div className="mt-1 text-sm text-muted">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function DetailSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="px-5 pb-5 pt-4">{children}</div>
    </Card>
  );
}

export interface Fact {
  label: string;
  value: React.ReactNode;
  hint?: string;
  mono?: boolean;
}

export function FactGrid({ facts, columns = 3 }: { facts: Fact[]; columns?: 2 | 3 | 4 }) {
  const gridClass =
    columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3";

  return (
    <dl className={cn("grid gap-x-6 gap-y-4", gridClass)}>
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{fact.label}</dt>
          <dd className={cn("mt-1 break-words text-sm text-foreground", fact.mono && "font-mono text-xs")}>{fact.value}</dd>
          {fact.hint ? <p className="mt-0.5 text-[11px] text-muted">{fact.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}
