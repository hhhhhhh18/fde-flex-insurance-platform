import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/api/http";
import { getRenewal } from "@/services/renewal-service";

/** Read-only renewal detail with its policy context and audit trail. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const renewal = await getRenewal(id);
  if (!renewal) throw new NotFoundError("Renewal", id);
  const audit = await prisma.auditEvent.findMany({
    where: { entityType: "Renewal", entityId: renewal.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({ renewal, audit });
});
