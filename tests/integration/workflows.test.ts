import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { generateDataset } from "@/lib/generator";
import { AuthorizationError } from "@/lib/authz";
import { ConflictError, ForbiddenError, InputError } from "@/lib/errors";
import { issuePolicy } from "@/services/policy-service";
import { createEndorsement, decideEndorsement } from "@/services/endorsement-service";
import { generateRenewal, respondToRenewal } from "@/services/renewal-service";
import { decideUnderwriting } from "@/services/underwriting-service";
import { evaluateQuote } from "@/services/quote-service";
import { addDays } from "@/services/mappers";

const ADMIN = { role: "ADMIN" as const, actorId: "test-admin" };
const ANALYST = { role: "OPERATIONS_ANALYST" as const, actorId: "test-analyst" };
const APPLICANT = { role: "APPLICANT" as const, actorId: "test-applicant" };
const REVIEWER = { role: "RISK_REVIEWER" as const, actorId: "test-reviewer" };

const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  await generateDataset({
    seed: 424242,
    scale: "small",
    datasetLabel: "integration",
    includeAnomalies: true,
    reset: true,
  });
}, 120_000);

describe("quote evaluation persistence", () => {
  it("persists the quote, coverage lines, factors and an audit event", async () => {
    const applicant = await prisma.applicant.findFirstOrThrow({ include: { assets: true } });
    const product = await prisma.product.findFirstOrThrow({
      where: { code: "PROP-SHIELD" },
      include: { coverageOptions: true },
    });
    const asset = applicant.assets.find((item) => item.assetType === "BUILDING");
    if (!asset) return;

    const required = product.coverageOptions.filter((option) => option.required);
    const quote = await evaluateQuote(
      {
        applicantId: applicant.id,
        productId: product.id,
        assetId: asset.id,
        coverages: required.map((option) => ({ code: option.code, limit: option.defaultLimit.toString() })),
      },
      ANALYST,
    );

    expect(quote.reference).toMatch(/^QTE-\d{4}-\d{5}$/);
    expect(quote.coverages.length).toBe(required.length);
    expect(Number(quote.grossPremium)).toBeGreaterThan(0);

    const audit = await prisma.auditEvent.count({ where: { entityType: "Quote", entityId: quote.id } });
    expect(audit).toBeGreaterThan(0);
  });

  it("rejects an applicant that does not exist", async () => {
    const product = await prisma.product.findFirstOrThrow();
    await expect(
      evaluateQuote({ applicantId: "does-not-exist", productId: product.id, coverages: [{ code: "X", limit: "1000" }] }, ANALYST),
    ).rejects.toThrow(/not found/i);
  });
});

describe("policy issuance prerequisites", () => {
  async function issuableQuote() {
    return prisma.quote.findFirstOrThrow({
      where: {
        decision: "ELIGIBLE",
        status: "EVALUATED",
        policy: null,
        grossPremium: { lte: 25000 },
        expiresAt: { gte: new Date() },
      },
      include: { asset: true },
    });
  }

  it("blocks roles without policy:issue", async () => {
    const quote = await issuableQuote();
    await expect(
      issuePolicy({ quoteId: quote.id, paymentConfirmed: true, effectiveFrom: "2030-01-01", termMonths: 12 }, APPLICANT),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("requires confirmed payment", async () => {
    const quote = await issuableQuote();
    await expect(
      issuePolicy({ quoteId: quote.id, paymentConfirmed: false, effectiveFrom: "2030-01-01", termMonths: 12 }, ANALYST),
    ).rejects.toBeInstanceOf(InputError);
  });

  it("issues an active policy, copies the premium and writes audit events", async () => {
    const quote = await issuableQuote();
    const policy = await issuePolicy(
      { quoteId: quote.id, paymentConfirmed: true, effectiveFrom: "2030-01-01", termMonths: 12, paymentReference: "PAY-TEST-1" },
      ANALYST,
    );

    expect(policy.status).toBe("ACTIVE");
    expect(policy.paymentStatus).toBe("PAID");
    expect(policy.premium.toString()).toBe(quote.grossPremium.toString());

    const events = await prisma.auditEvent.findMany({ where: { entityType: "Policy", entityId: policy.id } });
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining(["POLICY_CREATED", "POLICY_ACTIVATED"]),
    );
  });

  it("refuses to issue the same quote twice", async () => {
    const quote = await prisma.quote.findFirstOrThrow({ where: { policy: { isNot: null } } });
    await expect(
      issuePolicy({ quoteId: quote.id, paymentConfirmed: true, effectiveFrom: "2030-01-01", termMonths: 12 }, ANALYST),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a referred quote that has no approval", async () => {
    const quote = await prisma.quote.findFirstOrThrow({
      where: {
        decision: "REFERRED",
        policy: null,
        underwriting: { none: { status: "APPROVED" } },
      },
    });
    await expect(
      issuePolicy({ quoteId: quote.id, paymentConfirmed: true, effectiveFrom: "2030-01-01", termMonths: 12 }, ADMIN),
    ).rejects.toThrow();
  });

  it("enforces the analyst monetary authority", async () => {
    const source = await prisma.quote.findFirstOrThrow({ where: { policy: null, assetId: { not: null } } });
    const expensive = await prisma.quote.create({
      data: {
        reference: `QTE-2099-${String(Date.now()).slice(-5)}`,
        applicantId: source.applicantId,
        productId: source.productId,
        assetId: source.assetId,
        status: "EVALUATED",
        decision: "ELIGIBLE",
        decisionSummary: "Test fixture for authority limit",
        referralReasons: [],
        pricingBreakdown: { inputSnapshot: {} },
        coverageLimit: "100000.00",
        netPremium: "90000.00",
        grossPremium: "90000.00",
        factorProduct: "1.000000",
        pricingVersion: "test",
        rulesVersion: "test",
        evaluatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await expect(
      issuePolicy({ quoteId: expensive.id, paymentConfirmed: true, effectiveFrom: "2030-01-01", termMonths: 12 }, ANALYST),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await prisma.quote.delete({ where: { id: expensive.id } });
  });

  it("blocks overlapping cover for the same asset", async () => {
    const active = await prisma.policy.findFirstOrThrow({
      where: { status: "ACTIVE", assetId: { not: null } },
    });

    // Targeted fixture: an eligible quote for an asset that is already covered.
    const fixture = await prisma.quote.create({
      data: {
        reference: `QTE-2096-${String(Date.now()).slice(-5)}`,
        applicantId: active.applicantId,
        productId: active.productId,
        assetId: active.assetId,
        status: "EVALUATED",
        decision: "ELIGIBLE",
        decisionSummary: "Overlap fixture",
        referralReasons: [],
        pricingBreakdown: { inputSnapshot: {} },
        coverageLimit: "10000.00",
        netPremium: "100.00",
        grossPremium: "100.00",
        factorProduct: "1.000000",
        pricingVersion: "test",
        rulesVersion: "test",
        evaluatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await expect(
      issuePolicy(
        {
          quoteId: fixture.id,
          paymentConfirmed: true,
          effectiveFrom: active.effectiveFrom.toISOString().slice(0, 10),
          termMonths: 12,
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    await prisma.quote.delete({ where: { id: fixture.id } });
  });
});

describe("underwriting decisions", () => {
  it("blocks roles without underwriting:decide", async () => {
    const pending = await prisma.underwritingDecision.findFirstOrThrow({ where: { status: "PENDING" } });
    await expect(
      decideUnderwriting({ decisionId: pending.id, outcome: "APPROVED", notes: "looks fine to me" }, ANALYST),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("enforces reviewer monetary authority", async () => {
    const source = await prisma.quote.findFirstOrThrow({ where: { policy: null } });
    const quote = await prisma.quote.create({
      data: {
        reference: `QTE-2098-${String(Date.now()).slice(-5)}`,
        applicantId: source.applicantId,
        productId: source.productId,
        status: "EVALUATED",
        decision: "REFERRED",
        decisionSummary: "Authority fixture",
        referralReasons: [],
        pricingBreakdown: { inputSnapshot: {} },
        coverageLimit: "1000000.00",
        netPremium: "300000.00",
        grossPremium: "300000.00",
        factorProduct: "1.000000",
        pricingVersion: "test",
        rulesVersion: "test",
        evaluatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const decision = await prisma.underwritingDecision.create({
      data: {
        reference: `UWD-2098-${String(Date.now()).slice(-5)}`,
        quoteId: quote.id,
        status: "PENDING",
        triggerCodes: ["TEST"],
        summary: "Authority fixture",
      },
    });

    await expect(
      decideUnderwriting({ decisionId: decision.id, outcome: "APPROVED", notes: "authority check" }, REVIEWER),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await prisma.underwritingDecision.delete({ where: { id: decision.id } });
    await prisma.quote.delete({ where: { id: quote.id } });
  });

  it("approves a referral and records reviewer identity", async () => {
    const pending = await prisma.underwritingDecision.findFirstOrThrow({ where: { status: "PENDING" } });
    const decided = await decideUnderwriting(
      { decisionId: pending.id, outcome: "APPROVED", notes: "Approved within delegated authority" },
      REVIEWER,
    );

    expect(decided.status).toBe("APPROVED");
    expect(decided.reviewerRole).toBe("RISK_REVIEWER");

    const audit = await prisma.auditEvent.count({ where: { entityType: "UnderwritingDecision", entityId: pending.id } });
    expect(audit).toBeGreaterThan(0);
  });
});

describe("endorsements", () => {
  async function activePolicy() {
    return prisma.policy.findFirstOrThrow({
      where: {
        status: "ACTIVE",
        product: { code: "PROP-SHIELD" },
        effectiveFrom: { lte: new Date() },
        effectiveTo: { gte: new Date() },
      },
      include: { product: { include: { coverageOptions: true } } },
    });
  }

  it("rejects endorsements on cancelled policies", async () => {
    const cancelled = await prisma.policy.findFirstOrThrow({ where: { status: "CANCELLED" } });
    await expect(
      createEndorsement(
        {
          policyId: cancelled.id,
          type: "LIMIT_CHANGE",
          effectiveDate: today(),
          reason: "Attempt on cancelled policy",
          newLimit: "100000.00",
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects limits above the coverage option maximum", async () => {
    const policy = await activePolicy();
    const option = policy.product.coverageOptions.find((item) => item.active) ?? policy.product.coverageOptions[0];
    if (!option) return;

    await expect(
      createEndorsement(
        {
          policyId: policy.id,
          type: "LIMIT_CHANGE",
          effectiveDate: today(),
          reason: "Above permitted limit",
          coverageCode: option.code,
          newLimit: (Number(option.maxLimit) + 1000).toFixed(2),
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(InputError);
  });

  it("applies an approved limit change and updates the policy premium", async () => {
    const policy = await activePolicy();
    const option = policy.product.coverageOptions.find((item) => item.active) ?? policy.product.coverageOptions[0];
    if (!option) return;

    const newLimit = Math.min(Number(option.maxLimit), Number(policy.coverageLimit) + 25000).toFixed(2);
    const endorsement = await createEndorsement(
      {
        policyId: policy.id,
        type: "LIMIT_CHANGE",
        effectiveDate: today(),
        reason: "Customer requested higher limit",
        coverageCode: option.code,
        newLimit,
      },
      ANALYST,
    );
    expect(endorsement.status).toBe("PENDING");

    await expect(
      decideEndorsement({ endorsementId: endorsement.id, action: "APPROVE", notes: "within authority" }, APPLICANT),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const applied = await decideEndorsement(
      { endorsementId: endorsement.id, action: "APPROVE", notes: "Approved by operations" },
      ADMIN,
    );
    expect(applied.status).toBe("APPLIED");
    expect(applied.decidedAt).not.toBeNull();

    const updated = await prisma.policy.findUniqueOrThrow({ where: { id: policy.id } });
    expect(Number(updated.premium)).toBeCloseTo(Number(policy.premium) + Number(endorsement.premiumDelta), 2);
  });
});

describe("renewals", () => {
  it("refuses renewal offers for cancelled policies", async () => {
    const cancelled = await prisma.policy.findFirstOrThrow({ where: { status: "CANCELLED" } });
    await expect(generateRenewal({ policyId: cancelled.id, termMonths: 12, offerValidDays: 30 }, ANALYST)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("offers a renewal starting the day after expiry, once", async () => {
    const policy = await prisma.policy.findFirstOrThrow({
      where: { status: "ACTIVE", renewals: { none: { status: "OFFERED" } } },
    });

    const renewal = await generateRenewal({ policyId: policy.id, termMonths: 12, offerValidDays: 30 }, ANALYST);
    expect(renewal.status).toBe("OFFERED");
    expect(renewal.effectiveFrom.toISOString().slice(0, 10)).toBe(
      addDays(policy.effectiveTo.toISOString().slice(0, 10), 1),
    );

    await expect(
      generateRenewal({ policyId: policy.id, termMonths: 12, offerValidDays: 30 }, ANALYST),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("creates a successor policy when the offer is accepted", async () => {
    const renewal = await prisma.renewal.findFirstOrThrow({
      where: { status: "OFFERED", policy: { status: "ACTIVE" } },
      include: { policy: true },
    });

    const accepted = await respondToRenewal({ renewalId: renewal.id, action: "ACCEPT" }, ANALYST);
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.resultingPolicyId).toBeTruthy();

    const successor = await prisma.policy.findUniqueOrThrow({ where: { id: accepted.resultingPolicyId! } });
    expect(successor.status).toBe("PENDING_PAYMENT");
    expect(successor.effectiveFrom.toISOString().slice(0, 10)).toBe(renewal.effectiveFrom.toISOString().slice(0, 10));
  });
});

describe("database constraints", () => {
  it("enforces foreign keys in PostgreSQL", async () => {
    const product = await prisma.product.findFirstOrThrow();
    await expect(
      prisma.quote.create({
        data: {
          reference: `QTE-2097-${String(Date.now()).slice(-5)}`,
          applicantId: "missing-applicant",
          productId: product.id,
          status: "DRAFT",
          decision: "ELIGIBLE",
          decisionSummary: "fk test",
          referralReasons: [],
          pricingBreakdown: {},
          coverageLimit: "1000.00",
          netPremium: "10.00",
          grossPremium: "10.00",
          factorProduct: "1",
          pricingVersion: "t",
          rulesVersion: "t",
          evaluatedAt: new Date(),
          expiresAt: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("enforces unique business identifiers without leaving partial rows", async () => {
    const existing = await prisma.quote.findFirstOrThrow();
    const before = await prisma.quoteCoverage.count();

    await expect(
      prisma.quote.create({
        data: {
          reference: existing.reference,
          applicantId: existing.applicantId,
          productId: existing.productId,
          status: "DRAFT",
          decision: "ELIGIBLE",
          decisionSummary: "duplicate",
          referralReasons: [],
          pricingBreakdown: {},
          coverageLimit: "1000.00",
          netPremium: "10.00",
          grossPremium: "10.00",
          factorProduct: "1",
          pricingVersion: "t",
          rulesVersion: "t",
          evaluatedAt: new Date(),
          expiresAt: new Date(),
          coverages: { create: [{ coverageOptionId: (await prisma.coverageOption.findFirstOrThrow()).id, requestedLimit: "1000.00", approvedLimit: "1000.00", rateFactor: "1" }] },
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    expect(await prisma.quoteCoverage.count()).toBe(before);
  });
});
