import { currentActor, ok, parseBody, route } from "@/lib/api/http";
import { policyCancelSchema } from "@/lib/validation/schemas";
import { cancelPolicy } from "@/services/policy-service";


export const POST = route(async (req) => {
  const body = await parseBody(req, policyCancelSchema);
  const actor = await currentActor();
  const policy = await cancelPolicy(body, actor);
  return ok({ policy });
});
