import { currentActor, ok, parseBody, route } from "@/lib/api/http";
import { underwritingDecisionSchema } from "@/lib/validation/schemas";
import { decideUnderwriting } from "@/services/underwriting-service";


export const POST = route(async (req) => {
  const body = await parseBody(req, underwritingDecisionSchema);
  const actor = await currentActor();
  const decision = await decideUnderwriting(body, actor);
  return ok({ decision }, 201);
});
