import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { money, round2, dec } from "@/lib/money";
import { addDays, addMonths, dateOnly } from "@/services/mappers";
import { evaluateQuote, type Actor } from "@/services/quote-service";
import { cancelPolicy, expirePolicy, issuePolicy } from "@/services/policy-service";
import { createEndorsement, decideEndorsement } from "@/services/endorsement-service";
import { generateRenewal, respondToRenewal } from "@/services/renewal-service";
import { decideUnderwriting } from "@/services/underwriting-service";
import { AppError } from "@/lib/errors";
import { SeededRng } from "./rng";
import {
  ASSET_DESCRIPTIONS,
  CREDIT_BANDS,
  FIRST_NAMES,
  LAST_NAMES,
  OCCUPATIONS,
  PRODUCT_SEEDS,
  REGIONS,
  RISK_FACTOR_SEEDS,
} from "./catalog";
import { seedAnomalies } from "./anomalies";

/** Fixed evaluation anchor so premium and dates are reproducible across runs. */
export const DATASET_ANCHOR = "2026-10-01T00:00:00.000Z";
export const ANCHOR_YEAR = 2026;

export type Scale = "small" | "full";

export interface GenerationOptions {
  seed: number;
  scale: Scale;
  datasetLabel: string;
  includeAnomalies: boolean;
  reset: boolean;
}

export interface GenerationSummary {
  seed: number;
  scale: Scale;
  datasetLabel: string;
  anchor: string;
  counts: Record<string, number>;
  anomalies: number;
  skipped: { reason: string; detail: string }[];
  durationMs: number;
}

const SIZES: Record<Scale, { applicants: number; quotes: number }> = {
  small: { applicants: 14, quotes: 26 },
  full: { applicants: 140, quotes: 340 },
};

const generatorActor: Actor = { role: "ADMIN", actorId: "synthetic-generator" };
const analystActor: Actor = { role: "OPERATIONS_ANALYST", actorId: "synthetic-analyst" };
const reviewerActor: Actor = { role: "RISK_REVIEWER", actorId: "synthetic-reviewer" };

const ASSET_VALUE_RANGE: Record<string, [number, number, number]> = {
  VEHICLE: [8000, 220000, 45000],
  BUILDING: [120000, 2600000, 600000],
  SOLAR_PLANT: [60000, 900000, 250000],
  IT_INFRASTRUCTURE: [15000, 400000, 90000],
  MACHINERY: [25000, 800000, 180000],
};

const ASSET_TYPE_WEIGHTS = [
  { value: "VEHICLE", weight: 30 },
  { value: "BUILDING", weight: 25 },
  { value: "IT_INFRASTRUCTURE", weight: 20 },
  { value: "MACHINERY", weight: 15 },
  { value: "SOLAR_PLANT", weight: 10 },
];

const CATEGORY_ASSET_TYPES: Record<string, string[]> = {
  MOTOR: ["VEHICLE"],
  PROPERTY: ["BUILDING", "MACHINERY", "SOLAR_PLANT"],
  CYBER: ["IT_INFRASTRUCTURE"],
  LIABILITY: ["BUILDING", "MACHINERY", "SOLAR_PLANT", "IT_INFRASTRUCTURE", "VEHICLE"],
};

/**
 * Destructive reset of the synthetic dataset. Refuses to run in production or
 * against a database whose name does not look like a sandbox.
 */
export async function resetDataset(): Promise<void> {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("Refusing to reset data in production.");
  }
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (!/insurancelab/i.test(db)) {
    throw new Error(`Refusing to truncate database "${db}": name does not contain "insurancelab".`);
  }
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ValidationFinding", "ValidationRun", "AnomalyLabel", "AuditEvent",
      "Renewal", "Endorsement", "UnderwritingDecision", "Policy",
      "QuoteRiskFactor", "QuoteCoverage", "Quote",
      "InsuredAsset", "Applicant",
      "RiskFactor", "CoverageOption", "Product", "Counter"
    RESTART IDENTITY CASCADE;
  `);
}

/** Idempotent master-data load. Returns lookup maps used by generation. */
export async function seedMasterData() {
  for (const seed of PRODUCT_SEEDS) {
    const product = await prisma.product.upsert({
      where: { code: seed.code },
      update: {},
      create: {
        code: seed.code,
        name: seed.name,
        category: seed.category,
        status: "ACTIVE",
        description: seed.description,
        baseRate: seed.baseRate,
        minimumPremium: seed.minimumPremium,
        maxCoverageLimit: seed.maxCoverageLimit,
        referralThreshold: seed.referralThreshold,
        autoBindLimit: seed.autoBindLimit,
        minAssetValue: seed.minAssetValue,
        maxAssetValue: seed.maxAssetValue,
        minApplicantAge: seed.minApplicantAge,
        maxApplicantAge: seed.maxApplicantAge,
        effectiveFrom: dateOnly(seed.effectiveFrom),
        pricingVersion: seed.pricingVersion,
        rulesVersion: seed.rulesVersion,
      },
    });
    for (const coverage of seed.coverages) {
      await prisma.coverageOption.upsert({
        where: { productId_code: { productId: product.id, code: coverage.code } },
        update: {},
        create: { ...coverage, productId: product.id },
      });
    }
  }

  const products = await prisma.product.findMany({ include: { coverageOptions: true } });
  const productByCode = new Map(products.map((p) => [p.code, p]));

  for (const factor of RISK_FACTOR_SEEDS) {
    const productId = factor.productCode ? productByCode.get(factor.productCode)?.id ?? null : null;
    await prisma.riskFactor.upsert({
      where: { code: factor.code },
      update: {},
      create: {
        code: factor.code,
        label: factor.label,
        productId,
        metric: factor.metric,
        operator: factor.operator,
        thresholdValue: factor.thresholdValue,
        thresholdText: factor.thresholdText,
        multiplier: factor.multiplier,
        triggersReferral: factor.triggersReferral,
        explanation: factor.explanation,
      },
    });
  }

  return { productByCode };
}

/** Quote attempts allowed per missing quote before the run gives up and reports a shortfall. */
const QUOTE_ATTEMPT_MULTIPLIER = 3;

/**
 * Fixed reason text on every generator-created endorsement. It doubles as a fingerprint so a
 * rerun can recognise which policies the generator has already endorsed.
 */
const GENERATOR_ENDORSEMENT_REASON = "Insured requested increased limit following asset revaluation.";

/**
 * Highest numeric suffix among references that start with `prefix`
 * (e.g. "APP-2026-" -> 140). Used so new references continue after the
 * largest existing one instead of assuming references are contiguous.
 */
function maxReferenceNumber(references: string[], prefix: string): number {
  let max = 0;
  for (const reference of references) {
    if (!reference.startsWith(prefix)) continue;
    const n = Number.parseInt(reference.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export async function generateDataset(options: GenerationOptions): Promise<GenerationSummary> {
  const started = Date.now();
  const rng = new SeededRng(options.seed);
  const size = SIZES[options.scale];
  const anchor = new Date(DATASET_ANCHOR);
  const skipped: GenerationSummary["skipped"] = [];

  if (options.reset) await resetDataset();
  const { productByCode } = await seedMasterData();

  const existingApplicants = await prisma.applicant.count();

  if (existingApplicants > size.applicants && !options.reset) {
    throw new Error(
      `Database contains ${existingApplicants} applicants, exceeding the target of ${size.applicants}.`,
    );
  }

  // ---------- Applicants ----------
  // Existing applicants are loaded and reused; only the missing ones are created.
  const applicantRecords: { id: string; reference: string }[] = await prisma.applicant.findMany({
    select: { id: true, reference: true },
    orderBy: { reference: "asc" },
  });

  // Continue numbering after the highest existing reference so new references cannot collide.
  let applicantCounter = maxReferenceNumber(
    applicantRecords.map((a) => a.reference),
    `APP-${ANCHOR_YEAR}-`,
  );

  while (applicantRecords.length < size.applicants) {
    applicantCounter += 1;
    const i = applicantCounter;
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const age = rng.triangular(22, 74, 40);
    const dob = new Date(Date.UTC(ANCHOR_YEAR - age, rng.int(0, 11), rng.int(1, 28)));
    const occupation = rng.pick(OCCUPATIONS);
    const creditBand = rng.weighted(CREDIT_BANDS);
    const income = round2(dec(rng.int(28, 190) * 1000).plus(dec(rng.int(0, 99) * 10))).toFixed(2);

    const created = await prisma.applicant.create({
      data: {
        reference: `APP-${ANCHOR_YEAR}-${String(i).padStart(5, "0")}`,
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}.${i}@example-insure.test`,
        phone: `+44 20 7946 ${String(1000 + i).slice(-4)}`,
        dateOfBirth: dob,
        country: "GB",
        region: rng.pick(REGIONS),
        occupation: occupation.title,
        occupationClass: occupation.occupationClass,
        annualIncome: income,
        creditBand,
      },
    });
    applicantRecords.push({ id: created.id, reference: created.reference });
  }

  // ---------- Assets ----------
  // Existing assets are loaded and reused; assets are created only for applicants that have none.
  const assetRecords: {
    id: string;
    reference: string;
    applicantId: string;
    assetType: string;
    currentValue: Prisma.Decimal;
  }[] = await prisma.insuredAsset.findMany({
    select: {
      id: true,
      reference: true,
      applicantId: true,
      assetType: true,
      currentValue: true,
    },
    orderBy: { reference: "asc" },
  });

  // Continue numbering after the highest existing reference so new references cannot collide.
  let assetCounter = maxReferenceNumber(
    assetRecords.map((a) => a.reference),
    `AST-${ANCHOR_YEAR}-`,
  );
  const applicantsWithAssets = new Set(assetRecords.map((asset) => asset.applicantId));

  for (const applicant of applicantRecords) {
    if (applicantsWithAssets.has(applicant.id)) continue;
    const count = rng.weighted([
      { value: 1, weight: 40 },
      { value: 2, weight: 40 },
      { value: 3, weight: 20 },
    ]);
    for (let a = 0; a < count; a++) {
      assetCounter += 1;
      const assetType = rng.weighted(ASSET_TYPE_WEIGHTS);
      const [min, max, mode] = ASSET_VALUE_RANGE[assetType]!;
      const currentValue = round2(dec(rng.triangular(min, max, mode))).toFixed(2);
      const yearBuilt = ANCHOR_YEAR - rng.triangular(1, 32, 7);
      const condition = rng.weighted([
        { value: "EXCELLENT", weight: 25 },
        { value: "GOOD", weight: 45 },
        { value: "FAIR", weight: 22 },
        { value: "POOR", weight: 8 },
      ]);
      const riskDataComplete = rng.bool(0.92);
      const created = await prisma.insuredAsset.create({
        data: {
          reference: `AST-${ANCHOR_YEAR}-${String(assetCounter).padStart(5, "0")}`,
          applicantId: applicant.id,
          assetType: assetType as never,
          description: rng.pick(ASSET_DESCRIPTIONS[assetType]!),
          yearBuilt,
          purchaseValue: round2(dec(currentValue).times(1.15)).toFixed(2),
          currentValue,
          condition: condition as never,
          usage: rng.bool(0.65) ? "COMMERCIAL" : "PERSONAL",
          claimsHistory5y: rng.weighted([
            { value: 0, weight: 55 },
            { value: 1, weight: 25 },
            { value: 2, weight: 12 },
            { value: 3, weight: 5 },
            { value: 4, weight: 3 },
          ]),
          region: rng.pick(REGIONS),
          riskDataComplete,
          missingRiskField: riskDataComplete
            ? null
            : rng.pick(["flood_zone", "roof_condition", "security_controls", "maintenance_log"]),
        },
      });
      assetRecords.push({
        id: created.id,
        reference: created.reference,
        applicantId: created.applicantId,
        assetType: created.assetType,
        currentValue: created.currentValue,
      });
    }
  }

  const assetsByApplicant = new Map<string, typeof assetRecords>();
  for (const asset of assetRecords) {
    const list = assetsByApplicant.get(asset.applicantId) ?? [];
    list.push(asset);
    assetsByApplicant.set(asset.applicantId, list);
  }

  // ---------- Quotes (priced by the real engine) ----------
  // `size.quotes` is the desired TOTAL. The loop re-counts quotes from the database after
  // every attempt, so failed evaluations never count towards the target, and the number of
  // attempts is bounded so persistent failures cannot loop forever.
  let currentQuotes = await prisma.quote.count();
  const startingQuotes = currentQuotes;
  const maxQuoteAttempts = Math.max(0, size.quotes - currentQuotes) * QUOTE_ATTEMPT_MULTIPLIER;
  let quoteAttempts = 0;

  while (currentQuotes < size.quotes && quoteAttempts < maxQuoteAttempts) {
    quoteAttempts += 1;
    const productCode = rng.weighted([
      { value: "MOT-FLEET", weight: 34 },
      { value: "PROP-SHIELD", weight: 28 },
      { value: "CYB-GUARD", weight: 22 },
      { value: "LIA-FLEX", weight: 16 },
    ]);
    const product = productByCode.get(productCode)!;
    const allowedAssets = CATEGORY_ASSET_TYPES[product.category]!;

    const candidates = applicantRecords.filter((app) =>
      (assetsByApplicant.get(app.id) ?? []).some((asset) => allowedAssets.includes(asset.assetType)),
    );
    // Only LIABILITY quotes may proceed without a compatible asset; other products need one.
    if (candidates.length === 0 && product.category !== "LIABILITY") {
      skipped.push({
        reason: "no_compatible_asset",
        detail: `attempt ${quoteAttempts}: no applicant has an asset compatible with ${product.code}`,
      });
      continue;
    }
    const applicant = rng.pick(candidates.length > 0 ? candidates : applicantRecords);
    const compatible = (assetsByApplicant.get(applicant.id) ?? []).filter((asset) =>
      allowedAssets.includes(asset.assetType),
    );
    const asset =
      product.category === "LIABILITY" && rng.bool(0.5)
        ? undefined
        : compatible.length > 0
          ? rng.pick(compatible)
          : undefined;

    const coverages = product.coverageOptions
      .filter((option) => option.active)
      .filter((option) => option.required || rng.bool(0.55))
      .map((option) => {
        const multiplier = rng.pick(["0.6", "0.8", "1", "1.2", "1.5"]);
        const raw = dec(option.defaultLimit).times(multiplier);
        const limit = round2(
          dec(raw).lt(dec(option.minLimit))
            ? dec(option.minLimit)
            : dec(raw).gt(dec(option.maxLimit))
              ? dec(option.maxLimit)
              : raw,
        );
        return { code: option.code, limit: limit.toFixed(2) };
      });

    if (coverages.length === 0) {
      skipped.push({ reason: "no_coverage_selected", detail: `quote attempt ${quoteAttempts}` });
      continue;
    }

    try {
      await evaluateQuote(
        {
          applicantId: applicant.id,
          productId: product.id,
          assetId: asset?.id ?? null,
          coverages,
          asOf: anchor.toISOString(),
        },
        generatorActor,
      );
    } catch (error) {
      skipped.push({
        reason: "quote_evaluation_failed",
        detail: `attempt ${quoteAttempts}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    currentQuotes = await prisma.quote.count();
  }

  currentQuotes = await prisma.quote.count();
  if (currentQuotes < size.quotes) {
    skipped.push({
      reason: "quote_target_shortfall",
      detail: `Target ${size.quotes} quotes, database has ${currentQuotes} (started at ${startingQuotes}) after ${quoteAttempts} of ${maxQuoteAttempts} allowed attempts.`,
    });
  }

  // ---------- Underwriting outcomes for referred quotes ----------
  const referred = await prisma.underwritingDecision.findMany({
    where: { status: "PENDING" },
    include: { quote: true },
    orderBy: { reference: "asc" },
  });

  let uwDecided = 0;
  for (const decision of referred) {
    const roll = rng.next();
    let outcome: "APPROVED" | "DECLINED" | "INFORMATION_REQUESTED" | null = null;
    if (roll < 0.25) outcome = "APPROVED";
    else if (roll < 0.37) outcome = "DECLINED";
    else if (roll < 0.45) outcome = "INFORMATION_REQUESTED";
    if (!outcome) continue;
    try {
      await decideUnderwriting(
        {
          decisionId: decision.id,
          outcome,
          notes:
            outcome === "APPROVED"
              ? "Referral reviewed; risk accepted within delegated authority."
              : outcome === "DECLINED"
                ? "Referral declined: risk outside appetite for this product."
                : "Additional documentation requested from the applicant.",
          requestedInfo: outcome === "INFORMATION_REQUESTED" ? "Updated risk questionnaire" : undefined,
        },
        reviewerActor,
      );
      uwDecided += 1;
    } catch (error) {
      skipped.push({ reason: "underwriting_failed", detail: error instanceof Error ? error.message : String(error) });
    }
  }

  // ---------- Policies ----------
  const eligibleQuotes = await prisma.quote.findMany({
    where: { decision: "ELIGIBLE", status: "EVALUATED", policy: null },
    include: { asset: true },
    orderBy: { reference: "asc" },
  });

  const issuedPolicies: { id: string; reference: string; status: string; effectiveTo: string; coverageLimit: string }[] = [];
  for (const quote of eligibleQuotes) {
    if (!rng.bool(0.72)) continue;

    const vintage = rng.weighted([
      { value: "current", weight: 72 },
      { value: "expired", weight: 14 },
      { value: "fresh", weight: 14 },
    ]);
    const startOffset = vintage === "expired" ? -rng.int(430, 620) : vintage === "fresh" ? -rng.int(5, 40) : -rng.int(45, 300);
    const effectiveFrom = addDays(anchor.toISOString().slice(0, 10), startOffset);

    try {
      const policy = await issuePolicy(
        {
          quoteId: quote.id,
          paymentConfirmed: true,
          effectiveFrom,
          termMonths: 12,
          paymentReference: `PAY-${quote.reference.slice(-5)}`,
        },
        analystActor,
        anchor,
      );
      issuedPolicies.push({
        id: policy.id,
        reference: policy.reference,
        status: policy.status,
        effectiveTo: policy.effectiveTo.toISOString().slice(0, 10),
        coverageLimit: policy.coverageLimit.toString(),
      });

      if (vintage === "expired") {
        await expirePolicy(policy.id, analystActor, anchor);
        const target = issuedPolicies[issuedPolicies.length - 1]!;
        target.status = "EXPIRED";
      } else if (rng.bool(0.08)) {
        await cancelPolicy(
          { policyId: policy.id, reason: "Customer requested cancellation after asset disposal." },
          analystActor,
          anchor,
        );
        const target = issuedPolicies[issuedPolicies.length - 1]!;
        target.status = "CANCELLED";
      }
    } catch (error) {
      skipped.push({
        reason: "policy_issue_blocked",
        detail: `${quote.reference}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // ---------- Endorsements ----------
  const activePolicies = await prisma.policy.findMany({
    where: { status: "ACTIVE" },
    include: { quote: { select: { coverages: { include: { coverageOption: true } } } } },
    orderBy: { reference: "asc" },
  });

  // The schema allows several endorsements per policy, but the generator creates at most one.
  // Policies that already carry a generator endorsement are skipped so a rerun cannot add a second.
  const alreadyEndorsed = new Set(
    (
      await prisma.endorsement.findMany({
        where: { policyId: { in: activePolicies.map((p) => p.id) }, reason: GENERATOR_ENDORSEMENT_REASON },
        select: { policyId: true },
      })
    ).map((e) => e.policyId),
  );
  if (alreadyEndorsed.size > 0) {
    skipped.push({
      reason: "endorsement_already_generated",
      detail: `${alreadyEndorsed.size} active policies already have a generator endorsement.`,
    });
  }

  let endorsements = 0;
  for (const policy of activePolicies) {
    if (alreadyEndorsed.has(policy.id)) continue;
    if (!rng.bool(0.22)) continue;
    const coverage = policy.quote.coverages[0]?.coverageOption;
    if (!coverage) continue;
    const bump = rng.pick(["1.1", "1.2", "1.3"]);
    const newLimit = round2(dec(policy.coverageLimit).times(bump));
    const maxAllowed = dec(coverage.maxLimit);
    if (newLimit.gt(maxAllowed)) continue;

    const from = policy.effectiveFrom.toISOString().slice(0, 10);
    const to = policy.effectiveTo.toISOString().slice(0, 10);
    const effectiveDate = anchor.toISOString().slice(0, 10) >= from && anchor.toISOString().slice(0, 10) <= to ? anchor.toISOString().slice(0, 10) : from;

    try {
      const endorsement = await createEndorsement(
        {
          policyId: policy.id,
          type: "LIMIT_CHANGE",
          effectiveDate,
          reason: GENERATOR_ENDORSEMENT_REASON,
          newLimit: newLimit.toFixed(2),
          coverageCode: coverage.code,
        },
        analystActor,
      );
      const roll = rng.next();
      if (roll < 0.7) {
        await decideEndorsement({ endorsementId: endorsement.id, action: "APPROVE", notes: "Within delegated authority." }, generatorActor);
      } else if (roll < 0.85) {
        await decideEndorsement({ endorsementId: endorsement.id, action: "REJECT", notes: "Supporting valuation not provided." }, generatorActor);
      }
      endorsements += 1;
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      skipped.push({ reason: "endorsement_skipped", detail: `${policy.reference}: ${error.message}` });
    }
  }

  // ---------- Renewals ----------
  const renewable = await prisma.policy.findMany({
    where: { status: { in: ["ACTIVE", "EXPIRED"] } },
    orderBy: { reference: "asc" },
  });

  // generateRenewal already rejects a policy with an OFFERED or ACCEPTED renewal, but it would
  // accept a fresh offer after a DECLINED or EXPIRED one. The generator makes one renewal attempt
  // per policy, so any policy that already has a renewal is skipped.
  const alreadyRenewalProcessed = new Set(
    (
      await prisma.renewal.findMany({
        where: { policyId: { in: renewable.map((p) => p.id) } },
        select: { policyId: true },
      })
    ).map((r) => r.policyId),
  );
  if (alreadyRenewalProcessed.size > 0) {
    skipped.push({
      reason: "renewal_already_generated",
      detail: `${alreadyRenewalProcessed.size} renewable policies already have a renewal.`,
    });
  }

  let renewals = 0;
  for (const policy of renewable) {
    if (alreadyRenewalProcessed.has(policy.id)) continue;
    const daysToExpiry = Math.round(
      (dateOnly(policy.effectiveTo.toISOString().slice(0, 10)).getTime() - anchor.getTime()) / 86_400_000,
    );
    if (daysToExpiry > 120 || daysToExpiry < -200) continue;
    if (!rng.bool(0.55)) continue;
    try {
      const renewal = await generateRenewal({ policyId: policy.id, offerValidDays: 30, termMonths: 12 }, analystActor, anchor);
      const roll = rng.next();
      if (roll < 0.35) {
        const accepted = await respondToRenewal({ renewalId: renewal.id, action: "ACCEPT" }, analystActor, anchor);
        if (accepted.resultingPolicyId && rng.bool(0.5)) {
          await expirePolicy(policy.id, analystActor, anchor).catch(() => undefined);
        }
      } else if (roll < 0.5) {
        await respondToRenewal(
          { renewalId: renewal.id, action: "DECLINE", reason: "Insured placed cover with another carrier." },
          analystActor,
          anchor,
        );
      }
      renewals += 1;
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      skipped.push({ reason: "renewal_skipped", detail: `${policy.reference}: ${error.message}` });
    }
  }

  // ---------- Anomalies ----------
  // seedAnomalies mutates existing rows and creates new ones on every call (it is not idempotent),
  // and it writes its labels only at the end. Seed it at most once per database.
  let anomalies = 0;
  if (options.includeAnomalies) {
    const existingLabels = await prisma.anomalyLabel.count();
    if (existingLabels > 0) {
      skipped.push({
        reason: "anomalies_already_seeded",
        detail: `${existingLabels} anomaly labels already exist; anomaly injection skipped.`,
      });
    } else {
      anomalies = await seedAnomalies({ rng, datasetLabel: options.datasetLabel, anchor });
    }
  }

  const counts: Record<string, number> = {
    applicants: await prisma.applicant.count(),
    assets: await prisma.insuredAsset.count(),
    products: await prisma.product.count(),
    coverageOptions: await prisma.coverageOption.count(),
    riskFactors: await prisma.riskFactor.count(),
    quotes: await prisma.quote.count(),
    policies: await prisma.policy.count(),
    endorsements: await prisma.endorsement.count(),
    renewals: await prisma.renewal.count(),
    underwriting: await prisma.underwritingDecision.count(),
    auditEvents: await prisma.auditEvent.count(),
    anomalyLabels: await prisma.anomalyLabel.count(),
  };

  return {
    seed: options.seed,
    scale: options.scale,
    datasetLabel: options.datasetLabel,
    anchor: DATASET_ANCHOR,
    counts,
    anomalies,
    skipped,
    durationMs: Date.now() - started,
  };
}

/** Convenience wrapper used by scripts and the admin API. */
export async function generateFromArgv(argv: {
  seed?: number;
  scale?: Scale;
  datasetLabel?: string;
  includeAnomalies?: boolean;
  reset?: boolean;
}): Promise<GenerationSummary> {
  return generateDataset({
    seed: argv.seed ?? 20261001,
    scale: argv.scale ?? "small",
    datasetLabel: argv.datasetLabel ?? "baseline",
    includeAnomalies: argv.includeAnomalies ?? true,
    reset: argv.reset ?? false,
  });
}

export type { Prisma };
export { addMonths, money };