# Data dictionary

PostgreSQL 17, Prisma 6. All tables live in the `public` schema. Money is `NUMERIC`, never floating point.

## Conventions

| Topic | Rule |
| --- | --- |
| Primary keys | `id TEXT` (cuid) — internal only, never exported or shown as the record key |
| Business identifiers | `APP-/AST-/QTE-/POL-/END-/RNW-/UWD-YYYY-00001`, zero-padded to 5 digits, unique per prefix per year |
| Money | `NUMERIC(14,2)`; rating factors `NUMERIC(10,6)` |
| Rounding | Intermediate rating values 6dp HALF_UP; payable premium rounded to 2dp exactly once |
| Dates | Term dates `DATE`; event timestamps `TIMESTAMP` (UTC) |
| Enumerations | PostgreSQL enums (see below); invalid values are rejected by the database |
| Deletion | Business records are never deleted; state changes append history |
| Audit | `AuditEvent` is append-only and written in the same transaction as the change |

## Enumerations

`Role` APPLICANT · OPERATIONS_ANALYST · RISK_REVIEWER · ADMIN

`ProductCategory` MOTOR · PROPERTY · CYBER · LIABILITY

`ProductStatus` DRAFT · ACTIVE · RETIRED

`AssetType` VEHICLE · BUILDING · MACHINERY · SOLAR_PLANT · IT_INFRASTRUCTURE

`AssetCondition` EXCELLENT · GOOD · FAIR · POOR

`UsageType` PERSONAL · COMMERCIAL

`CoverageType` COLLISION · THEFT_FIRE · LIABILITY · FLOOD · EARTHQUAKE · CYBER_INCIDENT · BUSINESS_INTERRUPTION

`QuoteStatus` DRAFT · EVALUATED · ACCEPTED · EXPIRED · SUPERSEDED

`QuoteDecision` ELIGIBLE · INELIGIBLE · REFERRED · AWAITING_INFORMATION

`PolicyStatus` PENDING_PAYMENT · ACTIVE · CANCELLED · EXPIRED

`PaymentStatus` UNPAID · PAID · REFUNDED

`EndorsementType` COVERAGE_UPDATE · LIMIT_CHANGE · ASSET_UPDATE

`EndorsementStatus` PENDING · APPROVED · REJECTED · APPLIED

`RenewalStatus` OFFERED · ACCEPTED · DECLINED · EXPIRED

`UnderwritingStatus` PENDING · APPROVED · DECLINED · INFORMATION_REQUESTED

`Severity` INFO · LOW · MEDIUM · HIGH · CRITICAL

`RiskMetric` ASSET_AGE_YEARS · ASSET_VALUE · CREDIT_BAND · OCCUPATION_CLASS · CLAIMS_HISTORY_5Y · ASSET_CONDITION · USAGE_TYPE

`ComparisonOperator` GTE · LTE · EQ · IN

## Entities

### Applicant — `Applicant`

Party requesting cover. Fictional.

| Field | Type | Null | Rules |
| --- | --- | --- | --- |
| id | text | no | PK |
| reference | text | no | **unique**, `APP-YYYY-NNNNN` |
| firstName, lastName | text | no | non-empty |
| email | text | no | **unique**, fictional `.test` domain |
| phone | text | yes | |
| dateOfBirth | date | no | age 18–85 at evaluation |
| country, region | text | no | region used in portfolio analytics |
| occupation | text | no | |
| occupationClass | smallint | no | 1–4, higher = higher risk |
| annualIncome | numeric(14,2) | no | ≥ 0 |
| creditBand | varchar | no | `A`–`E`; `E` triggers a referral factor |
| createdAt, updatedAt | timestamp | no | |

Indexes: `(lastName, firstName)`, `(region)`. Relationships: 1—N `InsuredAsset`, `Quote`, `Policy`.

### InsuredAsset — `InsuredAsset`

| Field | Type | Null | Rules |
| --- | --- | --- | --- |
| id | text | no | PK |
| reference | text | no | **unique**, `AST-YYYY-NNNNN` |
| applicantId | text | no | FK → Applicant, `ON DELETE RESTRICT` |
| assetType | enum | no | see `AssetType` |
| description | text | no | |
| yearBuilt | smallint | no | ≤ current year |
| purchaseValue, currentValue | numeric(14,2) | no | ≥ 0 |
| condition | enum | no | drives a rating factor |
| usage | enum | no | PERSONAL / COMMERCIAL |
| claimsHistory5y | smallint | no | 0–5, default 0 |
| region | text | no | |
| riskDataComplete | boolean | no | `false` = deliberate data-quality condition |
| missingRiskField | text | yes | populated only when `riskDataComplete = false` |

Indexes: `(applicantId)`, `(assetType)`.

### Product — `Product`

| Field | Type | Null | Rules |
| --- | --- | --- | --- |
| id | text | no | PK |
| code | text | no | **unique**, e.g. `MOT-FLEET` |
| category, status | enum | no | only ACTIVE products are quotable |
| description | text | no | |
| baseRate | numeric(10,6) | no | premium per 1,000 of exposure |
| minimumPremium | numeric(14,2) | no | floor applied after rating |
| maxCoverageLimit | numeric(14,2) | no | cap across all coverage lines |
| referralThreshold | numeric(14,2) | no | premium above this requires review |
| autoBindLimit | numeric(14,2) | no | coverage above this requires review |
| minAssetValue, maxAssetValue | numeric(14,2) | no | asset eligibility band |
| minApplicantAge, maxApplicantAge | smallint | no | age eligibility band |
| effectiveFrom, effectiveTo | date | no / yes | product must be in force on the evaluation date |
| pricingVersion, rulesVersion | text | no | stamped onto every quote |
| createdAt, updatedAt | timestamp | no | |

Index: `(category, status)`.

### CoverageOption — `CoverageOption`

| Field | Type | Null | Rules |
| --- | --- | --- | --- |
| productId | text | no | FK → Product |
| code | text | no | **unique per product** (`productId`, `code`) |
| name | text | no | |
| coverageType | enum | no | |
| rateFactor | numeric(10,6) | no | multiplies the base rate for this line |
| minLimit, maxLimit, defaultLimit | numeric(14,2) | no | limit must sit inside [min, max] |
| required | boolean | no | mandatory coverages must be requested |
| active | boolean | no | inactive options are hidden from new quotes |

### RiskFactor — `RiskFactor`

Configurable multiplier; `productId = NULL` means it applies to every product.

| Field | Type | Null | Rules |
| --- | --- | --- | --- |
| code | text | no | **unique** |
| productId | text | yes | FK → Product |
| label, explanation | text | no | shown in the pricing breakdown |
| metric | enum | no | which observed value is compared |
| operator | enum | no | GTE / LTE / EQ / IN |
| thresholdValue | numeric | yes | numeric comparisons |
| thresholdText | text | yes | string comparisons (band, condition, usage) |
| multiplier | numeric(10,6) | no | applied when matched |
| triggersReferral | boolean | no | forces underwriting review |
| active | boolean | no | |

Index: `(productId, metric)`.

### Quote — `Quote`

Immutable pricing record; statuses only move forward.

| Field | Type | Null | Rules |
| --- | --- | --- | --- |
| reference | text | no | **unique**, `QTE-YYYY-NNNNN` |
| applicantId, productId | text | no | FK |
| assetId | text | yes | required for MOTOR/PROPERTY/CYBER categories |
| status | enum | no | DRAFT → EVALUATED → ACCEPTED / EXPIRED / SUPERSEDED |
| decision | enum | no | ELIGIBLE / INELIGIBLE / REFERRED / AWAITING_INFORMATION |
| decisionSummary | text | no | human-readable explanation |
| referralReasons | jsonb | no | array of `{code, message, category}` |
| pricingBreakdown | jsonb | no | formula trace **plus** `inputSnapshot` used to re-derive the premium |
| coverageLimit | numeric(14,2) | no | total requested (approved) limit |
| netPremium, grossPremium | numeric(14,2) | no | gross ≥ net; minimum premium may lift gross |
| factorProduct | numeric(10,6) | no | product of applied multipliers (floor 0.5) |
| pricingVersion, rulesVersion | text | no | configuration stamp |
| evaluatedAt | timestamp | no | pricing clock (`asOf`) |
| expiresAt | timestamp | no | evaluation + 30 days |

Indexes: `(decision, status)`, `(applicantId)`, `(productId)`.

### QuoteCoverage — bridge `QuoteCoverage`

`quoteId` + `coverageOptionId` (**unique together**), `requestedLimit`, `approvedLimit`, `rateFactor`,
`limitViolation` (set when the requested limit fell outside the option band).

### QuoteRiskFactor — bridge `QuoteRiskFactor`

`quoteId` + `riskFactorId` (**unique together**), `observedValue`, `multiplier`, `referred`.

### Policy — `Policy`

| Field | Type | Null | Rules |
| --- | --- | --- | --- |
| reference | text | no | **unique**, `POL-YYYY-NNNNN` |
| quoteId | text | no | **unique** — one policy per quote |
| applicantId, productId | text | no | FK |
| assetId | text | yes | FK; overlap checks use this |
| status | enum | no | PENDING_PAYMENT → ACTIVE → CANCELLED / EXPIRED |
| paymentStatus | enum | no | ACTIVE requires PAID |
| effectiveFrom, effectiveTo | date | no | `effectiveTo > effectiveFrom` |
| premium, coverageLimit | numeric(14,2) | no | premium copied from the quote, later adjusted by applied endorsements |
| issuedAt | timestamp | no | |
| issuedByRole, issuedBy | enum / text | no | actor that issued |
| cancelledAt, cancellationReason | timestamp / text | yes | required when status = CANCELLED |
| version | integer | no | optimistic counter |

Indexes: `(status)`, `(applicantId)`, `(assetId, effectiveFrom)`.

### Endorsement — `Endorsement`

Mid-term change request. Never mutates the original quote.

`reference` **unique** (`END-`), `policyId` FK, `type`, `status` (PENDING → APPROVED → APPLIED | REJECTED),
`effectiveDate` (inside the policy term), `reason`, `requestedChanges` jsonb (before/after),
`premiumDelta` numeric, `coverageCode`, `decidedBy`, `decidedByRole`, `decidedAt`, `decisionNotes`,
`rejectionReason`. Index: `(policyId, status)`.

### Renewal — `Renewal`

`reference` **unique** (`RNW-`), `policyId` FK, `status` (OFFERED → ACCEPTED | DECLINED | EXPIRED),
`offeredPremium`, `effectiveFrom = policy.effectiveTo + 1 day`, `effectiveTo`, `offerExpiresAt`,
`acceptedAt`, `declinedAt`, `declineReason`, `resultingPolicyId` **unique** FK → Policy.
Index: `(policyId, status)`.

### UnderwritingDecision — `UnderwritingDecision`

`reference` **unique** (`UWD-`), `quoteId` FK, `status` (PENDING / APPROVED / DECLINED / INFORMATION_REQUESTED),
`triggerCodes` text[], `summary`, `notes`, `requestedInfo`, `reviewer`, `reviewerRole`,
`authorityLimit` (recorded at decision time), `decidedAt`. Index: `(status, createdAt)`.

### AuditEvent — `AuditEvent`

Append-only. `entityType`, `entityId`, `entityRef`, `action`, `actorRole`, `actorId`, `summary`,
`payload` jsonb, `createdAt`. Indexes: `(entityType, entityId)`, `(createdAt)`.

### ValidationRun / ValidationFinding

A run records `datasetLabel`, `status`, `checksRun`, `findingsCount`, `summary` jsonb and timestamps.
Findings carry `issueCode`, `entityType`, `entityRef`, `category`, `severity`, `message`, `expectedValue`,
`observedValue`, `remediation`. Indexes: `(runId, severity)`, `(issueCode)`.

### AnomalyLabel — `AnomalyLabel`

Ground truth, isolated from detection. `datasetLabel`, `anomalyCode`, `entityType`, `entityRef`,
`expectedIssue`, `description`, **unique** `(datasetLabel, anomalyCode, entityRef)`.

### Counter — `Counter`

`key` PK (e.g. `QTE:2026`), `value` integer, `updatedAt`. Incremented inside the creating transaction with
`INSERT … ON CONFLICT DO UPDATE … RETURNING`, so identifiers are gap-free per prefix per year.

## Lifecycle states

| Entity | States and allowed transitions |
| --- | --- |
| Quote | DRAFT → EVALUATED → ACCEPTED \| EXPIRED \| SUPERSEDED |
| Policy | PENDING_PAYMENT → ACTIVE → CANCELLED \| EXPIRED |
| Endorsement | PENDING → APPROVED → APPLIED, or PENDING → REJECTED |
| Renewal | OFFERED → ACCEPTED \| DECLINED \| EXPIRED |
| Underwriting | PENDING → APPROVED \| DECLINED \| INFORMATION_REQUESTED; INFORMATION_REQUESTED → APPROVED \| DECLINED |

Invalid transitions raise `LifecycleError` (HTTP 409) before any write.
