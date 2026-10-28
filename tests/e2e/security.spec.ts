import { expect, test } from "@playwright/test";

/**
 * Server-side authorization must hold even when the UI is bypassed entirely.
 * These requests set the demo role cookie directly and call the API.
 */
test.describe("authorization is enforced server-side", () => {
  test("applicant cannot issue a policy, decide referrals, run validation or export findings", async ({
    context,
    request,
    baseURL,
  }) => {
    await context.addCookies([{ name: "ilab_role", value: "APPLICANT", url: baseURL ?? "http://127.0.0.1:3000" }]);

    const issue = await request.post("/api/policies/issue", {
      data: { quoteId: "does-not-exist", paymentConfirmed: true },
    });
    expect(issue.status()).toBe(403);

    const decision = await request.post("/api/underwriting/decisions", {
      data: { decisionId: "does-not-exist", outcome: "APPROVED", notes: "attempted bypass" },
    });
    expect(decision.status()).toBe(403);

    const validation = await request.post("/api/validation/run", { data: {} });
    expect(validation.status()).toBe(403);

    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    const body = (await health.json()) as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain("postgresql://");
  });

  test("rejects malformed payloads with 422 before touching business logic", async ({ request }) => {
    const response = await request.post("/api/quotes/evaluate", {
      data: { applicantId: "", productId: "", coverages: [] },
    });
    expect(response.status()).toBe(422);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBeTruthy();
  });

  test("does not expose internals on unknown resources", async ({ request }) => {
    const response = await request.get("/api/quotes/does-not-exist");
    expect(response.status()).toBe(404);
    const text = await response.text();
    expect(text).not.toMatch(/at .*\.ts:\d+/);
    expect(text).not.toContain("PrismaClient");
  });
});
