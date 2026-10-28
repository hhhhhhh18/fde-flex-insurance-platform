import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/api/http";
import { getPolicy } from "@/services/policy-service";


export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const policy = await getPolicy(id);
  if (!policy) throw new NotFoundError("Policy", id);
  const audit = await prisma.auditEvent.findMany({
    where: { entityType: "Policy", entityId: policy.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({ policy, audit });
});
