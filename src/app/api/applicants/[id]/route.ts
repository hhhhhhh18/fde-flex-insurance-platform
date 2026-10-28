import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/api/http";


export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const applicant = await prisma.applicant.findFirst({
    where: { OR: [{ id }, { reference: id }] },
    include: {
      assets: { orderBy: { reference: "asc" } },
      quotes: {
        orderBy: { evaluatedAt: "desc" },
        take: 25,
        include: { product: { select: { name: true, code: true } } },
      },
      policies: {
        orderBy: { issuedAt: "desc" },
        take: 25,
        include: { product: { select: { name: true } } },
      },
    },
  });
  if (!applicant) throw new NotFoundError("Applicant", id);
  return ok(applicant);
});
