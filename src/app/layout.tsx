import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: {
    default: "FDE Flex — Insurance Operations",
    template: "%s · FDE Flex",
  },
  description:
    "Insurance operations and risk evaluation console: quotes, policies, endorsements, renewals, underwriting referrals and data-quality exceptions.",
  applicationName: "FDE Flex",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const environment = process.env.NODE_ENV === "production" ? "production" : "development";

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {/* usePathname() inside the shell needs a Suspense boundary for PPR. */}
        <Suspense fallback={<div className="min-h-screen bg-background" aria-hidden />}>
          <AppShell environment={environment}>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
