import { currentActor, ok, parseBody, route } from "@/lib/api/http";
import { quoteEvaluateSchema } from "@/lib/validation/schemas";
import { evaluateQuote } from "@/services/quote-service";


export const POST = route(async (req) => {
  const body = await parseBody(req, quoteEvaluateSchema);
  const actor = await currentActor();
  const quote = await evaluateQuote(body, actor);
  return ok(
    {
      quote,
      explanation: {
        decision: quote.decision,
        summary: quote.decisionSummary,
        breakdown: quote.pricingBreakdown,
        referrals: quote.referralReasons,
        underwriting: quote.underwriting,
      },
    },
    201,
  );
});
