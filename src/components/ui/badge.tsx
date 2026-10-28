import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface-muted text-muted",
        primary: "border-[#dbe3fb] bg-primary-soft text-primary",
        success: "border-[#bbf7d0] bg-success-soft text-success",
        warning: "border-[#fde68a] bg-warning-soft text-warning",
        danger: "border-[#fecaca] bg-danger-soft text-danger",
        info: "border-[#bae6fd] bg-info-soft text-info",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
