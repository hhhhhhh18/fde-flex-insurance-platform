import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, parseQuery, route } from "@/lib/api/http";
import { paginationSchema } from "@/lib/validation/schemas";


export const GET = route(async (req: NextRequest) => {
  const { page, pageSize, q, status } = parseQuery(req, paginationSchema);

  const where: Prisma.InsuredAssetWhereInput = {
    ...(status ? { assetType: status as never } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { applicant: { lastName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.insuredAsset.findMany({
      where,
      include: {
        applicant: { select: { reference: true, firstName: true, lastName: true } },
        _count: { select: { quotes: true, policies: true } },
      },
      orderBy: { reference: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.insuredAsset.count({ where }),
  ]);

  return ok({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
});
