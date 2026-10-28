import { ok, route } from "@/lib/api/http";
import { getReportSummary } from "@/lib/analytics/dashboard";


export const GET = route(async () => {
  const summary = await getReportSummary();
  return ok({
    ...summary,
    generatedAt: new Date().toISOString(),
    dataset: "synthetic",
  });
});
