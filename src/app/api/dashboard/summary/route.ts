import { ok, route } from "@/lib/api/http";
import { getDashboardSummary } from "@/lib/analytics/dashboard";

/**
 * Aggregated dashboard payload. All figures are computed from database records
 * by src/lib/analytics/dashboard.ts - nothing here is hardcoded.
 */
export const GET = route(async () => {
  const summary = await getDashboardSummary();
  return ok({ ...summary, generatedAt: new Date().toISOString() });
});
