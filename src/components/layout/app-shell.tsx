"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_SECTIONS } from "./nav-config";
import { RoleSwitcher } from "./role-switcher";
import { cn } from "@/lib/utils";

interface AppShellProps {
  environment: string;
  children: React.ReactNode;
}

export function AppShell({ environment, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);


  const nav = (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 scrollbar-thin">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">{section.title}</p>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              if (!item.enabled) {
                return (
                  <li key={item.href}>
                    <span
                      aria-disabled="true"
                      title={`${item.description} — available in phase ${item.phase}`}
                      className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted/70"
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="rounded border border-sidebar-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                        Soon
                      </span>
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-active font-medium text-white"
                        : "text-sidebar-text hover:bg-sidebar-active/60 hover:text-white",
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-[18px]">
      <span className="flex size-9 items-center justify-center rounded-lg bg-[#1d4ed8] text-sm font-bold text-white">FX</span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">FDE Flex</p>
        <p className="text-[11px] text-sidebar-muted">Insurance operations</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        {brand}
        {nav}
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="text-[11px] font-medium text-sidebar-text">Synthetic portfolio</p>
          <p className="mt-1 text-[10px] leading-relaxed text-sidebar-muted">
            All records are generated. No real customer data.
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between border-b border-sidebar-border pr-3">
              <div className="flex-1">{brand}</div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-2 text-sidebar-text hover:bg-sidebar-active"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-muted hover:bg-surface-muted lg:hidden"
          >
            <Menu aria-hidden className="size-5" />
          </button>

          <div className="hidden items-center gap-2 text-xs text-muted sm:flex">
            <span className="hidden sm:inline">Operations console</span>
            <span aria-hidden className="hidden sm:inline text-border">
              /
            </span>
            <span className="font-medium text-foreground">Synthetic book</span>
            <span className="ml-1 hidden rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] uppercase tracking-wide md:inline">
              {environment}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <RoleSwitcher />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        <footer className="border-t border-border px-4 py-4 text-[11px] text-muted sm:px-6 lg:px-8">
          FDE Flex · Synthetic data only · Deterministic pricing engine · Figures computed from the operational database
        </footer>
      </div>
    </div>
  );
}
