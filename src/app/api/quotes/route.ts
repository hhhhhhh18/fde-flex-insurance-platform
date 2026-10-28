import type { NextRequest } from "next/server";
import { ok, parseQuery, route } from "@/lib/api/http";
import { paginationSchema } from "@/lib/validation/schemas";
import { listQuotes } from "@/services/quote-service";


export const GET = route(async (req: NextRequest) => {
  const query = parseQuery(req, paginationSchema);
  const result = await listQuotes({
    page: query.page,
    pageSize: query.pageSize,
    q: query.q,
    decision: query.status,
  });
  return ok({ ...result, pages: Math.ceil(result.total / result.pageSize) });
});
