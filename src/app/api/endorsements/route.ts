import type { NextRequest } from "next/server";
import { currentActor, ok, parseBody, parseQuery, route } from "@/lib/api/http";
import { paginationSchema, endorsementSchema } from "@/lib/validation/schemas";
import { createEndorsement, listEndorsements } from "@/services/endorsement-service";


export const GET = route(async (req: NextRequest) => {
  const query = parseQuery(req, paginationSchema);
  const result = await listEndorsements({ page: query.page, pageSize: query.pageSize, status: query.status });
  return ok({ ...result, pages: Math.ceil(result.total / result.pageSize) });
});

export const POST = route(async (req) => {
  const body = await parseBody(req, endorsementSchema);
  const actor = await currentActor();
  const endorsement = await createEndorsement(body, actor);
  return ok({ endorsement }, 201);
});
