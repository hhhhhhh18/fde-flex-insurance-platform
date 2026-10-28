import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/api/http";

/** Read-only product detail: configuration, coverage options and rating factors. */
export const GET = route<{ params: Promise<{ code: string }> }>(async (_req, ctx) => {
  const { code } = await ctx.params;
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: code }, { code }] },
    include: {
      coverageOptions: { orderBy: { code: "asc" } },
      riskFactors: { orderBy: { code: "asc" } },
      _count: { select: { quotes: true, policies: true } },
    },
  });
  if (!product) throw new NotFoundError("Product", code);

  const globalRiskFactors = await prisma.riskFactor.findMany({
    where: { productId: null },
    orderBy: { code: "asc" },
  });

  return ok({ product, globalRiskFactors });
});
