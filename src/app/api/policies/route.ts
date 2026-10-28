import type { NextRequest } from "next/server";
import { ok, parseQuery, route } from "@/lib/api/http";
import { paginationSchema } from "@/lib/validation/schemas";
import { listPolicies } from "@/services/policy-service";


export const GET = route(async (req: NextRequest) => {
  const query = parseQuery(req, paginationSchema);
  const result = await listPolicies({
    page: query.page,
    pageSize: query.pageSize,
    q: query.q,
    status: query.status,
  });
  return ok({ ...result, pages: Math.ceil(result.total / result.pageSize) });
});
