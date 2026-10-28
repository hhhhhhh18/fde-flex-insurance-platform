import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/api/http";
import { getQuote } from "@/services/quote-service";


export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const quote = await getQuote(id);
  if (!quote) throw new NotFoundError("Quote", id);
  const audit = await prisma.auditEvent.findMany({
    where: { entityType: "Quote", entityId: quote.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({ quote, audit });
});
