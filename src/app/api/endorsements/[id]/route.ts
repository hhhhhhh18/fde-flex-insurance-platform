import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/api/http";
import { getEndorsement } from "@/services/endorsement-service";

/** Read-only endorsement detail with the recorded change request and audit trail. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const endorsement = await getEndorsement(id);
  if (!endorsement) throw new NotFoundError("Endorsement", id);
  const audit = await prisma.auditEvent.findMany({
    where: { entityType: "Endorsement", entityId: endorsement.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({ endorsement, audit });
});
