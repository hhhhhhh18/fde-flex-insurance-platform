import { z } from "zod";
import { currentActor, ok, parseBody, route } from "@/lib/api/http";
import { activatePolicy } from "@/services/policy-service";


const schema = z.object({
  policyId: z.string().min(1).max(64),
  paymentReference: z.string().max(60).optional(),
});

export const POST = route(async (req) => {
  const body = await parseBody(req, schema);
  const actor = await currentActor();
  const policy = await activatePolicy(body, actor);
  return ok({ policy });
});
