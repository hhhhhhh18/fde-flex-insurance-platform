import type { PricingBreakdown, Quote } from "./api";

export interface EvaluationReferral {
  code: string;
  message: string;
  category: string;
}

export interface EvaluationExplanation {
  decision: string;
  summary: string;
  breakdown: PricingBreakdown;
  referrals: EvaluationReferral[];
  underwriting?: { reference: string; status: string } | null;
}

export interface EvaluateResponse {
  quote: Quote;
  explanation: EvaluationExplanation;
}

/** Shape of the structured error returned by the API wrapper. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[] | unknown;
  };
}
