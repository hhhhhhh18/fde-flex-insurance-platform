import { currentActor, ok, parseBody, route } from "@/lib/api/http";
import { renewalGenerateSchema } from "@/lib/validation/schemas";
import { generateRenewal } from "@/services/renewal-service";


export const POST = route(async (req) => {
  const body = await parseBody(req, renewalGenerateSchema);
  const actor = await currentActor();
  const renewal = await generateRenewal(body, actor);
  return ok({ renewal }, 201);
});
