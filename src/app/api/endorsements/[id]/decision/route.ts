import { z } from "zod";
import { currentActor, ok, parseBody, route } from "@/lib/api/http";
import { decideEndorsement } from "@/services/endorsement-service";


const schema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().min(3).max(500),
});

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  const actor = await currentActor();
  const endorsement = await decideEndorsement({ endorsementId: id, ...body }, actor);
  return ok({ endorsement });
});
