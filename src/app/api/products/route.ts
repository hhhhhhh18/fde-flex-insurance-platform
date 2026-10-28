import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api/http";


export const GET = route(async () => {
  const products = await prisma.product.findMany({
    include: {
      coverageOptions: { orderBy: { code: "asc" } },
      riskFactors: { orderBy: { code: "asc" } },
      _count: { select: { quotes: true, policies: true } },
    },
    orderBy: { code: "asc" },
  });

  const globalFactors = await prisma.riskFactor.findMany({
    where: { productId: null },
    orderBy: { code: "asc" },
  });

  return ok({ items: products, globalRiskFactors: globalFactors });
});
