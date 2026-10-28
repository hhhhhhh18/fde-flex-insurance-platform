import { currentActor, ok, parseBody, route } from "@/lib/api/http";
import { policyIssueSchema } from "@/lib/validation/schemas";
import { issuePolicy } from "@/services/policy-service";


export const POST = route(async (req) => {
  const body = await parseBody(req, policyIssueSchema);
  const actor = await currentActor();
  const policy = await issuePolicy(body, actor);
  return ok({ policy }, 201);
});
