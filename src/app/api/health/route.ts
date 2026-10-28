import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";


/** Liveness + readiness probe. Never returns secrets or connection strings. */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [applicants, policies] = await Promise.all([prisma.applicant.count(), prisma.policy.count()]);
    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        latencyMs: Date.now() - startedAt,
        dataset: { applicants, policies },
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", database: "unavailable", latencyMs: Date.now() - startedAt },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
