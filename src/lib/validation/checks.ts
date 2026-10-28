import { prisma } from "@/lib/db";
import { dec, money } from "@/lib/money";
import { priceQuote } from "@/lib/pricing/engine";
import type { PricingInput } from "@/lib/pricing/types";
import { getQuote } from "@/services/quote-service";

export type SeverityValue = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FindingCategory =
  | "identifier"
  | "completeness"
  | "referential"
  | "enumerated"
  | "date"
  | "lifecycle"
  | "pricing"
  | "monetary"
  | "coverage"
  | "renewal"
  | "overlap"
  | "data-quality";

export interface Finding {
  findingId: string;
  issueCode: string;
  entityType: string;
  entityRef: string;
  category: FindingCategory;
  severity: SeverityValue;
  message: string;
  expectedValue?: string;
  observedValue?: string;
  remediation: string;
  /** Filled by the runner from ground truth, never by a check. */
  groundTruth?: { anomalyCode: string; expectedIssue: string } | null;
}

const finding = (f: Omit<Finding, "findingId">): Finding => ({
  ...f,
  findingId: `${f.issueCode}:${f.entityRef}`,
});

/** 1. Duplicate business identifiers (guards imported/patched data). */
export async function checkDuplicateIdentifiers(): Promise<Finding[]> {
  const rows = await prisma.$queryRaw<{ reference: string; cnt: bigint }[]>`
    SELECT reference, COUNT(*)::bigint AS cnt FROM (
      SELECT reference FROM "Applicant"
      UNION ALL SELECT reference FROM "InsuredAsset"
      UNION ALL SELECT reference FROM "Quote"
      UNION ALL SELECT reference FROM "Policy"
      UNION ALL SELECT reference FROM "Endorsement"
      UNION ALL SELECT reference FROM "Renewal"
      UNION ALL SELECT reference FROM "UnderwritingDecision"
    ) refs
    GROUP BY reference HAVING COUNT(*) > 1;
  `;
  const findings = rows.map((row) =>
    finding({
      issueCode: "DATA_DUPLICATE_ID",
      entityType: "Identifier",
      entityRef: row.reference,
      category: "identifier",
      severity: "CRITICAL",
      message: `Business identifier ${row.reference} appears ${row.cnt} times.`,
      expectedValue: "1 occurrence",
      observedValue: `${row.cnt} occurrences`,
      remediation: "Assign a new sequence number to the duplicate record and re-check the counter table.",
    }),
  );

  const duplicateEmails = await prisma.$queryRaw<{ email: string; cnt: bigint }[]>`
    SELECT lower(email) AS email, COUNT(*)::bigint AS cnt FROM "Applicant"
    GROUP BY lower(email) HAVING COUNT(*) > 1;
  `;
  for (const row of duplicateEmails) {
    findings.push(
      finding({
        issueCode: "DATA_DUPLICATE_ID",
        entityType: "Applicant",
        entityRef: row.email,
        category: "identifier",
        severity: "HIGH",
        message: `Email ${row.email} is used by ${row.cnt} applicants.`,
        expectedValue: "unique email",
        observedValue: String(row.cnt),
        remediation: "Deduplicate the applicant records or correct the email address.",
      }),
    );
  }
  return findings;
}

/** 2. Missing required business values. */
export async function checkMissingRequiredValues(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const applicants = await prisma.applicant.findMany({ where: { OR: [{ region: "" }, { occupation: "" }] } });
  for (const a of applicants) {
    findings.push(
      finding({
        issueCode: "DATA_REQUIRED_MISSING",
        entityType: "Applicant",
        entityRef: a.reference,
        category: "completeness",
        severity: "MEDIUM",
        message: "Applicant is missing region or occupation.",
        expectedValue: "non-empty region and occupation",
        observedValue: `region="${a.region}" occupation="${a.occupation}"`,
        remediation: "Obtain the missing details from the application form.",
      }),
    );
  }

  const quotes = await prisma.quote.findMany({
    where: { OR: [{ coverageLimit: { lte: 0 } }, { grossPremium: { lte: 0 } }, { netPremium: { lt: 0 } }] },
  });
  for (const q of quotes) {
    findings.push(
      finding({
        issueCode: "DATA_REQUIRED_MISSING",
        entityType: "Quote",
        entityRef: q.reference,
        category: "completeness",
        severity: "HIGH",
        message: "Quote has a non-positive coverage limit or premium.",
        expectedValue: "coverageLimit > 0 and premium > 0",
        observedValue: `limit=${q.coverageLimit.toString()} premium=${q.grossPremium.toString()}`,
        remediation: "Re-evaluate the quote through the pricing engine.",
      }),
    );
  }

  const assets = await prisma.insuredAsset.findMany({ where: { description: "" } });
  for (const asset of assets) {
    findings.push(
      finding({
        issueCode: "DATA_REQUIRED_MISSING",
        entityType: "InsuredAsset",
        entityRef: asset.reference,
        category: "completeness",
        severity: "MEDIUM",
        message: "Asset has no description.",
        expectedValue: "non-empty description",
        observedValue: '""',
        remediation: "Add the asset description from the schedule.",
      }),
    );
  }
  return findings;
}

/** 3. Referential integrity violations (defence in depth over FK constraints). */
export async function checkForeignKeys(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const orphanAssets = await prisma.$queryRaw<{ reference: string }[]>`
    SELECT a.reference FROM "InsuredAsset" a
    LEFT JOIN "Applicant" p ON p.id = a."applicantId"
    WHERE p.id IS NULL;
  `;
  for (const row of orphanAssets) {
    findings.push(
      finding({
        issueCode: "DATA_FK_ORPHAN",
        entityType: "InsuredAsset",
        entityRef: row.reference,
        category: "referential",
        severity: "CRITICAL",
        message: "Asset references an applicant that does not exist.",
        expectedValue: "existing applicantId",
        observedValue: "missing parent",
        remediation: "Relink the asset to a valid applicant or remove it.",
      }),
    );
  }

  const orphanQuotes = await prisma.$queryRaw<{ reference: string }[]>`
    SELECT q.reference FROM "Quote" q
    LEFT JOIN "Applicant" a ON a.id = q."applicantId"
    LEFT JOIN "Product" p ON p.id = q."productId"
    WHERE a.id IS NULL OR p.id IS NULL;
  `;
  for (const row of orphanQuotes) {
    findings.push(
      finding({
        issueCode: "DATA_FK_ORPHAN",
        entityType: "Quote",
        entityRef: row.reference,
        category: "referential",
        severity: "CRITICAL",
        message: "Quote references a missing applicant or product.",
        expectedValue: "existing applicant and product",
        observedValue: "missing parent",
        remediation: "Recreate the quote against valid master data.",
      }),
    );
  }

  const orphanPolicies = await prisma.$queryRaw<{ reference: string }[]>`
    SELECT p.reference FROM "Policy" p
    LEFT JOIN "Quote" q ON q.id = p."quoteId"
    WHERE q.id IS NULL;
  `;
  for (const row of orphanPolicies) {
    findings.push(
      finding({
        issueCode: "DATA_FK_ORPHAN",
        entityType: "Policy",
        entityRef: row.reference,
        category: "referential",
        severity: "CRITICAL",
        message: "Policy references a missing quote.",
        expectedValue: "existing quoteId",
        observedValue: "missing parent",
        remediation: "Re-issue the policy from a valid quote.",
      }),
    );
  }
  return findings;
}

/** 4. Values outside the allowed domain. */
export async function checkEnumeratedValues(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const badCredit = await prisma.$queryRaw<{ reference: string; creditBand: string }[]>`
    SELECT reference, "creditBand" FROM "Applicant" WHERE "creditBand" NOT IN ('A','B','C','D','E');
  `;
  for (const row of badCredit) {
    findings.push(
      finding({
        issueCode: "DATA_ENUM_INVALID",
        entityType: "Applicant",
        entityRef: row.reference,
        category: "enumerated",
        severity: "HIGH",
        message: `Credit band "${row.creditBand}" is not an allowed band.`,
        expectedValue: "A|B|C|D|E",
        observedValue: row.creditBand,
        remediation: "Correct the credit band from the credit bureau response.",
      }),
    );
  }

  const badOccupations = await prisma.$queryRaw<{ reference: string; occupationClass: number }[]>`
    SELECT reference, "occupationClass" FROM "Applicant" WHERE "occupationClass" < 1 OR "occupationClass" > 4;
  `;
  for (const row of badOccupations) {
    findings.push(
      finding({
        issueCode: "DATA_ENUM_INVALID",
        entityType: "Applicant",
        entityRef: row.reference,
        category: "enumerated",
        severity: "MEDIUM",
        message: `Occupation class ${row.occupationClass} is outside 1..4.`,
        expectedValue: "1..4",
        observedValue: String(row.occupationClass),
        remediation: "Reclassify the occupation.",
      }),
    );
  }
  return findings;
}

/** 5. Date ordering / term validity. */
export async function checkDateOrdering(): Promise<Finding[]> {
  const findings: Finding[] = [];

  const policies = await prisma.policy.findMany({ orderBy: { reference: "asc" } });
  for (const p of policies) {
    if (p.effectiveTo <= p.effectiveFrom) {
      findings.push(
        finding({
          issueCode: "DATE_ORDER_INVALID",
          entityType: "Policy",
          entityRef: p.reference,
          category: "date",
          severity: "CRITICAL",
          message: "Policy end date is not after its start date.",
          expectedValue: `effectiveTo > ${p.effectiveFrom.toISOString().slice(0, 10)}`,
          observedValue: p.effectiveTo.toISOString().slice(0, 10),
          remediation: "Correct the term end date and re-issue the schedule.",
        }),
      );
    }
  }

  const renewals = await prisma.renewal.findMany({ include: { policy: true }, orderBy: { reference: "asc" } });
  for (const r of renewals) {
    if (r.effectiveTo <= r.effectiveFrom) {
      findings.push(
        finding({
          issueCode: "DATE_ORDER_INVALID",
          entityType: "Renewal",
          entityRef: r.reference,
          category: "date",
          severity: "HIGH",
          message: "Renewal term end is not after its start.",
          expectedValue: "effectiveTo > effectiveFrom",
          observedValue: `${r.effectiveFrom.toISOString().slice(0, 10)}..${r.effectiveTo.toISOString().slice(0, 10)}`,
          remediation: "Regenerate the renewal offer with a valid term.",
        }),
      );
    }
  }

  const endorsements = await prisma.endorsement.findMany({ include: { policy: true }, orderBy: { reference: "asc" } });
  for (const e of endorsements) {
    if (e.effectiveDate < e.policy.effectiveFrom || e.effectiveDate > e.policy.effectiveTo) {
      findings.push(
        finding({
          issueCode: "DATE_ORDER_INVALID",
          entityType: "Endorsement",
          entityRef: e.reference,
          category: "date",
          severity: "HIGH",
          message: "Endorsement effective date falls outside the policy term.",
          expectedValue: `${e.policy.effectiveFrom.toISOString().slice(0, 10)}..${e.policy.effectiveTo.toISOString().slice(0, 10)}`,
          observedValue: e.effectiveDate.toISOString().slice(0, 10),
          remediation: "Move the effective date inside the policy term or issue a new policy.",
        }),
      );
    }
  }
  return findings;
}

/** 6. Lifecycle / authorization violations. */
export async function checkLifecycle(): Promise<Finding[]> {
  const findings: Finding[] = [];

  const policies = await prisma.policy.findMany({
    include: {
      quote: { include: { underwriting: true } },
    },
    orderBy: { reference: "asc" },
  });

  for (const p of policies) {
    if (p.status === "ACTIVE" && p.paymentStatus === "UNPAID") {
      findings.push(
        finding({
          issueCode: "LIFECYCLE_INVALID",
          entityType: "Policy",
          entityRef: p.reference,
          category: "lifecycle",
          severity: "CRITICAL",
          message: "Policy is ACTIVE while premium is unpaid.",
          expectedValue: "paymentStatus PAID before activation",
          observedValue: "UNPAID",
          remediation: "Suspend the policy until payment is received, or record the payment reference.",
        }),
      );
    }

    const requiresApproval = p.quote.decision === "REFERRED" || p.issuedByRole === "APPLICANT";
    const approved = p.quote.underwriting.some((u) => u.status === "APPROVED");
    if (requiresApproval && !approved) {
      findings.push(
        finding({
          issueCode: "LIFECYCLE_INVALID",
          entityType: "Policy",
          entityRef: p.reference,
          category: "lifecycle",
          severity: "CRITICAL",
          message: `Policy bound by ${p.issuedByRole} without a recorded underwriting approval.`,
          expectedValue: "APPROVED underwriting decision by an authorized reviewer",
          observedValue: `issuedByRole=${p.issuedByRole}, underwriting=${p.quote.underwriting.map((u) => u.status).join(",") || "none"}`,
          remediation: "Escalate to a risk reviewer; reverse the binding if approval is not granted.",
        }),
      );
    }

    if (p.status === "CANCELLED" && !p.cancellationReason) {
      findings.push(
        finding({
          issueCode: "LIFECYCLE_INVALID",
          entityType: "Policy",
          entityRef: p.reference,
          category: "lifecycle",
          severity: "MEDIUM",
          message: "Cancelled policy has no recorded reason.",
          expectedValue: "cancellationReason present",
          observedValue: "null",
          remediation: "Record the cancellation reason from the customer request.",
        }),
      );
    }
  }

  const endorsements = await prisma.endorsement.findMany();
  for (const e of endorsements) {
    if (e.status === "APPLIED" && !e.decidedAt) {
      findings.push(
        finding({
          issueCode: "LIFECYCLE_INVALID",
          entityType: "Endorsement",
          entityRef: e.reference,
          category: "lifecycle",
          severity: "HIGH",
          message: "Endorsement is APPLIED without a decision timestamp.",
          expectedValue: "decidedAt present",
          observedValue: "null",
          remediation: "Record the approving reviewer and timestamp.",
        }),
      );
    }
  }

  const renewals = await prisma.renewal.findMany();
  for (const r of renewals) {
    if (r.status === "ACCEPTED" && !r.resultingPolicyId) {
      findings.push(
        finding({
          issueCode: "LIFECYCLE_INVALID",
          entityType: "Renewal",
          entityRef: r.reference,
          category: "lifecycle",
          severity: "HIGH",
          message: "Renewal accepted but no successor policy exists.",
          expectedValue: "resultingPolicyId present",
          observedValue: "null",
          remediation: "Create the successor policy or revert the renewal to OFFERED.",
        }),
      );
    }
  }
  return findings;
}

/** 7. Premium must equal the deterministic formula output for the recorded inputs. */
export async function checkPremiumFormula(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const quotes = await prisma.quote.findMany({ orderBy: { reference: "asc" } });

  for (const quote of quotes) {
    const snapshot = (quote.pricingBreakdown as unknown as { inputSnapshot?: PricingInput } | null)?.inputSnapshot;
    if (!snapshot) {
      findings.push(
        finding({
          issueCode: "PRM_FORMULA_MISMATCH",
          entityType: "Quote",
          entityRef: quote.reference,
          category: "pricing",
          severity: "HIGH",
          message: "Quote has no pricing input snapshot; premium cannot be independently recomputed.",
          expectedValue: "inputSnapshot present",
          observedValue: "missing",
          remediation: "Re-evaluate the quote so the snapshot is persisted.",
        }),
      );
      continue;
    }

    const recomputed = priceQuote(snapshot);
    if (!dec(recomputed.breakdown.grossPremium).eq(dec(quote.grossPremium))) {
      findings.push(
        finding({
          issueCode: "PRM_FORMULA_MISMATCH",
          entityType: "Quote",
          entityRef: quote.reference,
          category: "pricing",
          severity: "CRITICAL",
          message: "Stored gross premium differs from the deterministic pricing formula.",
          expectedValue: money(recomputed.breakdown.grossPremium),
          observedValue: money(quote.grossPremium),
          remediation: "Re-run the pricing engine; do not hand-edit premium values.",
        }),
      );
    }
  }
  return findings;
}

/** 8. Monetary reconciliation between related records. */
export async function checkMonetaryReconciliation(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const policies = await prisma.policy.findMany({
    include: { quote: true, endorsements: { where: { status: "APPLIED" } } },
    orderBy: { reference: "asc" },
  });

  for (const policy of policies) {
    const delta = policy.endorsements.reduce((acc, e) => acc.plus(dec(e.premiumDelta)), dec(0));
    const expected = dec(policy.quote.grossPremium).plus(delta);
    if (!dec(policy.premium).eq(expected)) {
      findings.push(
        finding({
          issueCode: "MON_RECONCILIATION",
          entityType: "Policy",
          entityRef: policy.reference,
          category: "monetary",
          severity: "HIGH",
          message: "Policy premium does not reconcile to the quote premium plus applied endorsements.",
          expectedValue: money(expected),
          observedValue: money(policy.premium),
          remediation: "Recompute the policy premium from the quote and endorsement deltas.",
        }),
      );
    }
  }

  for (const quote of await prisma.quote.findMany({ orderBy: { reference: "asc" } })) {
    if (dec(quote.netPremium).lt(0) || dec(quote.grossPremium).lt(0)) {
      findings.push(
        finding({
          issueCode: "MON_RECONCILIATION",
          entityType: "Quote",
          entityRef: quote.reference,
          category: "monetary",
          severity: "CRITICAL",
          message: "Quote contains a negative premium amount.",
          expectedValue: ">= 0.00",
          observedValue: `${quote.netPremium.toString()} / ${quote.grossPremium.toString()}`,
          remediation: "Correct the rating inputs and re-evaluate.",
        }),
      );
    }
  }
  return findings;
}

/** 9. Coverage limits versus configured option bounds. */
export async function checkCoverageLimits(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const lines = await prisma.quoteCoverage.findMany({
    include: { coverageOption: true, quote: true },
  });

  for (const line of lines) {
    const limit = dec(line.requestedLimit);
    const option = line.coverageOption;
    if (limit.gt(dec(option.maxLimit)) || limit.lt(dec(option.minLimit))) {
      findings.push(
        finding({
          issueCode: "COV_LIMIT_EXCEEDED",
          entityType: "Quote",
          entityRef: line.quote.reference,
          category: "coverage",
          severity: "CRITICAL",
          message: `Coverage ${option.code} limit ${limit.toFixed(2)} is outside the permitted range.`,
          expectedValue: `${option.minLimit.toString()}..${option.maxLimit.toString()}`,
          observedValue: limit.toFixed(2),
          remediation: "Reduce the limit to the configured maximum or refer for a bespoke facility.",
        }),
      );
    }
  }
  return findings;
}

/** 10. Renewal relationship validity. */
export async function checkRenewalRelationships(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const renewals = await prisma.renewal.findMany({
    include: { policy: true, resultingPolicy: true },
    orderBy: { reference: "asc" },
  });

  const byPolicy = new Map<string, number>();
  for (const r of renewals) {
    if (r.status === "OFFERED") byPolicy.set(r.policyId, (byPolicy.get(r.policyId) ?? 0) + 1);

    if (r.policy.status === "CANCELLED") {
      findings.push(
        finding({
          issueCode: "RNW_INVALID_RELATIONSHIP",
          entityType: "Renewal",
          entityRef: r.reference,
          category: "renewal",
          severity: "HIGH",
          message: `Renewal exists for cancelled policy ${r.policy.reference}.`,
          expectedValue: "renewal only for ACTIVE or EXPIRED policies",
          observedValue: "CANCELLED",
          remediation: "Withdraw the renewal offer and document the case.",
        }),
      );
    }

    const expectedStart = new Date(r.policy.effectiveTo);
    expectedStart.setUTCDate(expectedStart.getUTCDate() + 1);
    if (r.effectiveFrom.getTime() !== expectedStart.getTime()) {
      findings.push(
        finding({
          issueCode: "RNW_INVALID_RELATIONSHIP",
          entityType: "Renewal",
          entityRef: r.reference,
          category: "renewal",
          severity: "MEDIUM",
          message: "Renewal does not start the day after the expiring policy.",
          expectedValue: expectedStart.toISOString().slice(0, 10),
          observedValue: r.effectiveFrom.toISOString().slice(0, 10),
          remediation: "Regenerate the renewal from the policy expiry date.",
        }),
      );
    }

    if (r.status === "ACCEPTED" && r.resultingPolicy && r.resultingPolicy.effectiveFrom.getTime() !== r.effectiveFrom.getTime()) {
      findings.push(
        finding({
          issueCode: "RNW_INVALID_RELATIONSHIP",
          entityType: "Renewal",
          entityRef: r.reference,
          category: "renewal",
          severity: "HIGH",
          message: "Successor policy start date differs from the accepted renewal term.",
          expectedValue: r.effectiveFrom.toISOString().slice(0, 10),
          observedValue: r.resultingPolicy.effectiveFrom.toISOString().slice(0, 10),
          remediation: "Align the successor policy with the accepted offer.",
        }),
      );
    }
  }

  for (const [policyId, count] of byPolicy) {
    if (count > 1) {
      const policy = renewals.find((r) => r.policyId === policyId)!.policy;
      findings.push(
        finding({
          issueCode: "RNW_INVALID_RELATIONSHIP",
          entityType: "Policy",
          entityRef: policy.reference,
          category: "renewal",
          severity: "MEDIUM",
          message: `${count} open renewal offers exist for the same policy.`,
          expectedValue: "1 open offer",
          observedValue: String(count),
          remediation: "Withdraw duplicate offers, keeping the latest.",
        }),
      );
    }
  }
  return findings;
}

/** 11. Unexplained overlapping live coverage for the same asset. */
export async function checkPolicyOverlaps(): Promise<Finding[]> {
  const rows = await prisma.$queryRaw<
    { ref_a: string; ref_b: string; asset_ref: string; from_a: string; to_a: string }[]
  >`
    SELECT a.reference AS ref_a, b.reference AS ref_b, asset.reference AS asset_ref,
           a."effectiveFrom"::text AS from_a, a."effectiveTo"::text AS to_a
    FROM "Policy" a
    JOIN "Policy" b
      ON a."assetId" = b."assetId" AND a.id < b.id
     AND a.status IN ('ACTIVE','PENDING_PAYMENT')
     AND b.status IN ('ACTIVE','PENDING_PAYMENT')
     AND a."effectiveFrom" <= b."effectiveTo"
     AND b."effectiveFrom" <= a."effectiveTo"
    JOIN "InsuredAsset" asset ON asset.id = a."assetId"
    ORDER BY a.reference, b.reference;
  `;

  return rows.map((row) =>
    finding({
      issueCode: "POL_OVERLAP",
      entityType: "Policy",
      entityRef: row.ref_b,
      category: "overlap",
      severity: "CRITICAL",
      message: `Coverage overlaps ${row.ref_a} for asset ${row.asset_ref}; the overlap is not explained by a recorded replacement.`,
      expectedValue: `no live coverage overlapping ${row.from_a}..${row.to_a}`,
      observedValue: `${row.ref_a} and ${row.ref_b} both live`,
      remediation: "Cancel or amend one policy and record the reason as an endorsement.",
    }),
  );
}

/** 12. Missing risk information that was not reflected in the decision. */
export async function checkRiskInformation(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const assets = await prisma.insuredAsset.findMany({
    where: { riskDataComplete: false },
    include: {
      quotes: { where: { decision: "ELIGIBLE" }, select: { reference: true } },
      policies: { where: { status: "ACTIVE" }, select: { reference: true } },
    },
    orderBy: { reference: "asc" },
  });

  for (const asset of assets) {
    if (asset.quotes.length === 0 && asset.policies.length === 0) continue;
    findings.push(
      finding({
        issueCode: "DQ_RISK_INFO_MISSING",
        entityType: "InsuredAsset",
        entityRef: asset.reference,
        category: "data-quality",
        severity: "HIGH",
        message: `Risk information is incomplete (${asset.missingRiskField ?? "unspecified"}) but the risk was priced as eligible.`,
        expectedValue: "AWAITING_INFORMATION decision until the questionnaire is complete",
        observedValue: `eligible quotes: ${asset.quotes.map((q) => q.reference).join(",") || "none"}; active policies: ${asset.policies.map((p) => p.reference).join(",") || "none"}`,
        remediation: "Place the case on hold, collect the missing risk data, then re-evaluate.",
      }),
    );
  }
  return findings;
}

export const CHECKS: { name: string; run: () => Promise<Finding[]> }[] = [
  { name: "duplicate-identifiers", run: checkDuplicateIdentifiers },
  { name: "missing-required-values", run: checkMissingRequiredValues },
  { name: "foreign-keys", run: checkForeignKeys },
  { name: "enumerated-values", run: checkEnumeratedValues },
  { name: "date-ordering", run: checkDateOrdering },
  { name: "lifecycle", run: checkLifecycle },
  { name: "premium-formula", run: checkPremiumFormula },
  { name: "monetary-reconciliation", run: checkMonetaryReconciliation },
  { name: "coverage-limits", run: checkCoverageLimits },
  { name: "renewal-relationships", run: checkRenewalRelationships },
  { name: "policy-overlaps", run: checkPolicyOverlaps },
  { name: "risk-information", run: checkRiskInformation },
];
/** Loads the detector input for one quote (exported for tests). */
export async function loadQuoteForRecompute(reference: string) {
  return getQuote(reference);
}
