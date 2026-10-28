# Business rules

All monetary arithmetic is `HALF_UP` with 6dp intermediates and a single 2dp rounding of the payable premium. The implementation lives in `src/lib/pricing/engine.ts`; this document describes behaviour, not code.

## 1. Pricing formula

For each requested coverage option `i`:

```
exposureUnits_i   = approvedLimit_i / 1000
contribution_i    = exposureUnits_i × baseRate × coverageRateFactor_i
premiumAtBase     = Σ contribution_i
factorProduct     = Π matchedRiskMultiplier   (floored at 0.500000)
premiumAfterFactors = premiumAtBase × factorProduct
netPremium        = round2(premiumAfterFactors)
grossPremium      = max(netPremium, product.minimumPremium)
```

- `baseRate` is premium per 1,000 of coverage limit, configured per product.
- Coverage rate factors are per option (e.g. theft 0.65 of collision).
- Risk multipliers come from configured `RiskFactor` rows that match the observed metric.
- The factor floor prevents runaway discounts; `factorFloorApplied` records when it binds.

**Worked example** (used in tests): product base rate 2.000000, collision 100,000 at rate factor 1.0, credit band D at ×1.20.

```
exposure units      = 100
premium at base     = 100 × 2.000000 × 1.0 = 200.00
combined factor     = 1.200000
premium after       = 240.00
minimum (150)       = not binding
gross premium       = 240.00
```

## 2. Eligibility rules

Evaluated before referrals. Any blocking rule produces `INELIGIBLE`; pricing still runs so the applicant sees an indicative premium and the recorded reason.

| Code | Condition |
|---|---|
| `E_PRODUCT_STATUS` / `E_PRODUCT_RETIRED` | Product is not `ACTIVE` or is retired |
| `E_PRODUCT_NOT_YET_EFFECTIVE` | Evaluation date outside the product's effective window |
| `E_APPLICANT_AGE` | Age below `minApplicantAge` or above `maxApplicantAge` (exact boundaries allowed) |
| `E_NO_COVERAGE_REQUESTED` | Empty coverage list |
| `E_COVERAGE_UNKNOWN` | Coverage code not configured for any product |
| `E_COVERAGE_CROSS_PRODUCT` | Coverage exists but belongs to a different product |
| `E_COVERAGE_DUPLICATE` | Same coverage requested twice |
| `E_COVERAGE_INACTIVE` | Coverage option is inactive |
| `E_REQUIRED_COVERAGE_MISSING` | A `required` option was not requested |
| `E_COVERAGE_LIMIT_BELOW_MIN` / `E_COVERAGE_LIMIT_ABOVE_MAX` | Requested limit outside the option's band; approved limit is clamped to the band |
| `E_TOTAL_COVERAGE_ABOVE_PRODUCT_MAX` | Sum of limits exceeds the product maximum |
| `E_ASSET_REQUIRED` | Product category requires an insured asset but none was supplied |
| `E_ASSET_TYPE_MISMATCH` | Asset type not insurable under the product category |
| `E_ASSET_VALUE_RANGE` | Asset value outside the product's range |
| `E_CREDIT_BAND_INVALID` | Credit band not in A–E |

### Data-quality hold

`DQ_RISK_INFORMATION_MISSING` is non-blocking but changes the decision to `AWAITING_INFORMATION`: the asset is flagged `riskDataComplete = false` (with `missingRiskField`), so the quote cannot bind until information is supplied.

## 3. Referral (underwriting) rules

Evaluated only when eligibility passes and no data-quality hold applies. Any trigger produces `REFERRED`.

| Code | Condition |
|---|---|
| `R_PREMIUM_ABOVE_THRESHOLD` | `grossPremium > product.referralThreshold` |
| `R_COVERAGE_ABOVE_AUTOBIND` | total coverage `> product.autoBindLimit` |
| `R_CLAIMS_HISTORY` | a matched factor with `triggersReferral = true` (claims history) |
| Factor-driven referrals | any applied `RiskFactor` marked `triggersReferral` |

Decision precedence: `INELIGIBLE` → `AWAITING_INFORMATION` → `REFERRED` → `ELIGIBLE`.

## 4. Roles and monetary authority

| Role | Permissions | Authority (max premium) |
|---|---|---|
| `APPLICANT` | quote:evaluate, export:read | 0 — cannot bind |
| `OPERATIONS_ANALYST` | + policy:issue, policy:cancel, endorsement:submit/decide, renewal:generate/respond, validation:run | 25,000 |
| `RISK_REVIEWER` | + underwriting:decide, endorsement:decide | 250,000 |
| `ADMIN` | all, including data:generate | 1,000,000 |

Authority is checked against the **gross premium** of the quote (and against the premium delta for endorsements), not against a user-entered amount.

## 5. Lifecycle rules

```
Quote      DRAFT → EVALUATED → { ACCEPTED | EXPIRED | SUPERSEDED }
Policy     PENDING_PAYMENT → ACTIVE → { CANCELLED | EXPIRED }
Endorsement PENDING → APPROVED → APPLIED   |   PENDING → REJECTED
Renewal    OFFERED → { ACCEPTED | DECLINED | EXPIRED }
Underwriting PENDING → { APPROVED | DECLINED | INFORMATION_REQUESTED }
              INFORMATION_REQUESTED → { APPROVED | DECLINED }
```

Terminal states cannot be re-opened (e.g. a cancelled policy can never be reactivated).

### Policy issuance prerequisites

All must hold, in this order: quote exists → not already issued → `EVALUATED` → not expired → payment confirmed → decision `ELIGIBLE` (or `REFERRED` with an `APPROVED` decision whose reviewer authority covers the premium) → actor permission and authority → no overlapping live policy for the same asset.

Issuance writes `POLICY_CREATED`, then transitions `PENDING_PAYMENT → ACTIVE` with `POLICY_ACTIVATED`, both audited.

### Cancellation

Only `ACTIVE` or `PENDING_PAYMENT` policies can be cancelled; a reason of at least 5 characters is required and stored with the timestamp.

### Endorsements

- Policy must be `ACTIVE` and the effective date inside the policy term.
- Limit changes are validated against the coverage option band and the product maximum.
- The policy is re-priced with the engine from the stored snapshot, producing `premiumDelta`.
- Approval requires `endorsement:decide` plus authority for a positive delta.
- Applying writes the new limit, adjusts the policy premium by exactly `premiumDelta`, and is audited.

### Renewals

- Only `ACTIVE` or `EXPIRED` policies are eligible; `CANCELLED` is always rejected.
- At most one `OFFERED` renewal per policy.
- The offer term starts the day after the expiring policy ends.
- The offer is re-priced at the renewal start date and stored with its own quote (preserving one-policy-per-quote).
- Acceptance creates a successor policy in `PENDING_PAYMENT` and links it via `resultingPolicyId`; `DECLINE` requires no reason but records one when supplied.
- Offers past `offerExpiresAt` cannot be accepted.

## 6. Data-quality and anomaly rules

The validator runs twelve rule families (identifiers, completeness, referential integrity, enums, dates, lifecycle, pricing formula, monetary reconciliation, coverage limits, renewal relationships, policy overlaps, risk information).

Each finding carries: stable `issueCode`, entity type and reference, category, severity, message, expected/observed values, remediation, and — when applicable — a ground-truth label.

Seven anomaly types are injected deliberately:

| Anomaly | Expected issue |
|---|---|
| Premium inflated 5% without re-rating | `PRM_FORMULA_MISMATCH` |
| Policy bound from a referred quote without approval or payment | `LIFECYCLE_INVALID` |
| Coverage above the option maximum | `COV_LIMIT_EXCEEDED` |
| Renewal offered for a cancelled policy | `RNW_INVALID_RELATIONSHIP` |
| Overlapping live cover for one asset | `POL_OVERLAP` |
| Risk information missing while cover is in force | `DQ_RISK_INFO_MISSING` |
| Policy end date before its start date | `DATE_ORDER_INVALID` |

Injection never mutates a record that already carries dependent history (a policy with renewals or endorsements is not used for the date-inversion anomaly), and duplicated records copy a self-consistent pricing snapshot.
