import { z } from "zod";
import { currentActor, ok, parseBody, route } from "@/lib/api/http";
import { respondToRenewal } from "@/services/renewal-service";


const schema = z.object({
  action: z.enum(["ACCEPT", "DECLINE"]),
  reason: z.string().max(300).optional(),
});

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  const actor = await currentActor();
  const renewal = await respondToRenewal({ renewalId: id, ...body }, actor);
  return ok({ renewal });
});
