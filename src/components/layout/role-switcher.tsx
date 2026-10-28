"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { humanize } from "@/lib/format";

const ROLES = ["APPLICANT", "OPERATIONS_ANALYST", "RISK_REVIEWER", "ADMIN"] as const;

/**
 * Demo identity control. Changing the role writes an httpOnly cookie through the
 * API; every server action re-checks permissions, so this is a convenience, not
 * a security boundary (documented in the README).
 */
interface SessionInfo {
  role: string;
  permissions: string[];
  authorityLimit: string;
  demoMode?: boolean;
}

function formatAuthority(value: string): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  if (numeric <= 0) return "not permitted";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numeric);
}

export function RoleSwitcher() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [current, setCurrent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session/role", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: SessionInfo) => {
        if (cancelled) return;
        setSession(data);
        setCurrent(data.role);
        setDemoMode(data.demoMode !== false);
      })
      .catch(() => {
        if (!cancelled) setError("Session unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function change(next: string) {
    const previous = current;
    setCurrent(next);
    setError(null);
    try {
      const response = await fetch("/api/session/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as SessionInfo;
      setSession(data);
      startTransition(() => router.refresh());
    } catch {
      setCurrent(previous);
      setError("Could not switch role. Try again.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
        <ShieldCheck aria-hidden className="size-3.5" />
        {session && Number(session.authorityLimit) <= 0 ? "No binding authority" : `Authority ${session ? formatAuthority(session.authorityLimit) : "—"}`}
      </span>
      <div className="hidden h-5 w-px bg-border sm:block" aria-hidden />
      <ShieldCheck aria-hidden className="size-4 text-muted sm:hidden" />

      {demoMode ? (
        <>
          <label htmlFor="role-switcher" className="sr-only">
            Acting role
          </label>
          <div className="relative">
            <select
              id="role-switcher"
              value={current || "APPLICANT"}
              disabled={pending}
              onChange={(event) => void change(event.target.value)}
              className={cn(
                "h-8 cursor-pointer appearance-none rounded-lg border border-border bg-surface pl-3 pr-8 text-xs font-medium text-foreground",
                "hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                pending && "opacity-60",
              )}
            >
              {ROLES.map((option) => (
                <option key={option} value={option}>
                  {humanize(option)}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-muted">
              ▼
            </span>
          </div>
        </>
      ) : (
        <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] text-muted">
          SSO required
        </span>
      )}
      {error ? (
        <span role="alert" className="text-[11px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
