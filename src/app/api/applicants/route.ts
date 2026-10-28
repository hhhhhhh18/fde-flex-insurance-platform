import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, parseQuery, route } from "@/lib/api/http";
import { paginationSchema } from "@/lib/validation/schemas";
import type { Prisma } from "@prisma/client";


export const GET = route(async (req: NextRequest) => {
  const { page, pageSize, q } = parseQuery(req, paginationSchema);

  const where: Prisma.ApplicantWhereInput = q
    ? {
        OR: [
          { reference: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { region: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.applicant.findMany({
      where,
      include: { _count: { select: { assets: true, quotes: true, policies: true } } },
      orderBy: { reference: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.applicant.count({ where }),
  ]);

  return ok({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
});
