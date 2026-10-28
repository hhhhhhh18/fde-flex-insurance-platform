import { currentActor, ok, parseBody, route } from "@/lib/api/http";
import { assertAuthorized } from "@/lib/authz";
import { validationRunSchema } from "@/lib/validation/schemas";
import { runValidation } from "@/lib/validation/runner";

export const maxDuration = 60;

export const POST = route(async (req) => {
  const actor = await currentActor();
  assertAuthorized(actor.role, "validation:run");
  const body = await parseBody(req, validationRunSchema);
  const report = await runValidation({ datasetLabel: body.datasetLabel, persist: body.persist });
  return ok(report, 201);
});
