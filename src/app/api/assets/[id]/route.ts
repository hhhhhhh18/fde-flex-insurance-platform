import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/api/http";

/** Read-only asset detail with the quotes and policies attached to it. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const asset = await prisma.insuredAsset.findFirst({
    where: { OR: [{ id }, { reference: id }] },
    include: {
      applicant: true,
      quotes: {
        orderBy: { evaluatedAt: "desc" },
        take: 25,
        include: { product: { select: { name: true, code: true } } },
      },
      policies: {
        orderBy: { effectiveFrom: "desc" },
        take: 25,
        include: { product: { select: { name: true, code: true } } },
      },
    },
  });
  if (!asset) throw new NotFoundError("Insured asset", id);
  return ok(asset);
});
