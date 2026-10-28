import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api/http";


export const GET = route(async (req: NextRequest) => {
  const includeGroundTruth = req.nextUrl.searchParams.get("includeGroundTruth") === "true";
  const run = await prisma.validationRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    include: {
      findings: {
        orderBy: [{ severity: "desc" }, { entityRef: "asc" }],
      },
    },
  });

  if (!run) {
    return ok({ run: null, findings: [], labels: [] });
  }

  const labels = includeGroundTruth
    ? await prisma.anomalyLabel.findMany({
        where: { datasetLabel: run.datasetLabel },
        orderBy: [{ anomalyCode: "asc" }, { entityRef: "asc" }],
      })
    : [];

  return ok({ run, findings: run.findings, labels });
});
