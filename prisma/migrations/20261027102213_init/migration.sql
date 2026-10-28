-- CreateEnum
CREATE TYPE "Role" AS ENUM ('APPLICANT', 'OPERATIONS_ANALYST', 'RISK_REVIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('MOTOR', 'PROPERTY', 'CYBER', 'LIABILITY');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('VEHICLE', 'BUILDING', 'SOLAR_PLANT', 'IT_INFRASTRUCTURE', 'MACHINERY');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('PERSONAL', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "CoverageType" AS ENUM ('COLLISION', 'THEFT', 'FIRE', 'FLOOD', 'EARTHQUAKE', 'GENERAL_LIABILITY', 'BUSINESS_INTERRUPTION', 'CYBER_INCIDENT');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'EVALUATED', 'ACCEPTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "QuoteDecision" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'REFERRED', 'AWAITING_INFORMATION');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EndorsementType" AS ENUM ('COVERAGE_UPDATE', 'LIMIT_CHANGE', 'ASSET_UPDATE');

-- CreateEnum
CREATE TYPE "EndorsementStatus" AS ENUM ('PENDING', 'APPROVED', 'APPLIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UnderwritingStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'INFORMATION_REQUESTED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskMetric" AS ENUM ('ASSET_AGE_YEARS', 'ASSET_VALUE', 'CREDIT_BAND', 'OCCUPATION_CLASS', 'CLAIMS_HISTORY_5Y', 'ASSET_CONDITION', 'USAGE_TYPE');

-- CreateEnum
CREATE TYPE "ComparisonOperator" AS ENUM ('GTE', 'LTE', 'EQ', 'IN');

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "region" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "occupationClass" SMALLINT NOT NULL,
    "annualIncome" DECIMAL(14,2) NOT NULL,
    "creditBand" VARCHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuredAsset" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "description" TEXT NOT NULL,
    "yearBuilt" SMALLINT NOT NULL,
    "purchaseValue" DECIMAL(14,2) NOT NULL,
    "currentValue" DECIMAL(14,2) NOT NULL,
    "condition" "AssetCondition" NOT NULL,
    "usage" "UsageType" NOT NULL,
    "claimsHistory5y" SMALLINT NOT NULL DEFAULT 0,
    "region" TEXT NOT NULL,
    "riskDataComplete" BOOLEAN NOT NULL DEFAULT true,
    "missingRiskField" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuredAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT NOT NULL,
    "baseRate" DECIMAL(10,6) NOT NULL,
    "minimumPremium" DECIMAL(14,2) NOT NULL,
    "maxCoverageLimit" DECIMAL(14,2) NOT NULL,
    "referralThreshold" DECIMAL(14,2) NOT NULL,
    "autoBindLimit" DECIMAL(14,2) NOT NULL,
    "minAssetValue" DECIMAL(14,2) NOT NULL,
    "maxAssetValue" DECIMAL(14,2) NOT NULL,
    "minApplicantAge" SMALLINT NOT NULL,
    "maxApplicantAge" SMALLINT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "pricingVersion" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coverageType" "CoverageType" NOT NULL,
    "rateFactor" DECIMAL(10,6) NOT NULL,
    "minLimit" DECIMAL(14,2) NOT NULL,
    "maxLimit" DECIMAL(14,2) NOT NULL,
    "defaultLimit" DECIMAL(14,2) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskFactor" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metric" "RiskMetric" NOT NULL,
    "operator" "ComparisonOperator" NOT NULL,
    "thresholdValue" DECIMAL(14,4),
    "thresholdText" TEXT,
    "multiplier" DECIMAL(10,6) NOT NULL,
    "triggersReferral" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RiskFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "decision" "QuoteDecision" NOT NULL,
    "decisionSummary" TEXT NOT NULL,
    "referralReasons" JSONB NOT NULL DEFAULT '[]',
    "pricingBreakdown" JSONB NOT NULL,
    "coverageLimit" DECIMAL(14,2) NOT NULL,
    "netPremium" DECIMAL(14,2) NOT NULL,
    "grossPremium" DECIMAL(14,2) NOT NULL,
    "factorProduct" DECIMAL(10,6) NOT NULL,
    "pricingVersion" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteCoverage" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "coverageOptionId" TEXT NOT NULL,
    "requestedLimit" DECIMAL(14,2) NOT NULL,
    "approvedLimit" DECIMAL(14,2) NOT NULL,
    "rateFactor" DECIMAL(10,6) NOT NULL,
    "limitViolation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuoteCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRiskFactor" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "riskFactorId" TEXT NOT NULL,
    "observedValue" TEXT NOT NULL,
    "multiplier" DECIMAL(10,6) NOT NULL,
    "referred" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuoteRiskFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE NOT NULL,
    "premium" DECIMAL(14,2) NOT NULL,
    "coverageLimit" DECIMAL(14,2) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByRole" "Role" NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endorsement" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "type" "EndorsementType" NOT NULL,
    "status" "EndorsementStatus" NOT NULL DEFAULT 'PENDING',
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedChanges" JSONB NOT NULL,
    "premiumDelta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "approvedByRole" "Role",
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renewal" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" "RenewalStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredPremium" DECIMAL(14,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE NOT NULL,
    "offerExpiresAt" DATE NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "resultingPolicyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Renewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnderwritingDecision" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "status" "UnderwritingStatus" NOT NULL DEFAULT 'PENDING',
    "triggerCodes" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL,
    "reviewer" TEXT,
    "reviewerRole" "Role",
    "authorityLimit" DECIMAL(14,2),
    "notes" TEXT,
    "requestedInfo" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnderwritingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityRef" TEXT,
    "action" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "actorId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "datasetLabel" TEXT NOT NULL,
    "checksRun" INTEGER NOT NULL DEFAULT 0,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "summary" JSONB,

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "issueCode" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityRef" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "message" TEXT NOT NULL,
    "expectedValue" TEXT,
    "observedValue" TEXT,
    "remediation" TEXT NOT NULL,

    CONSTRAINT "ValidationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyLabel" (
    "id" TEXT NOT NULL,
    "datasetLabel" TEXT NOT NULL,
    "anomalyCode" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityRef" TEXT NOT NULL,
    "expectedIssue" TEXT NOT NULL,
    "expectedDecision" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_reference_key" ON "Applicant"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_email_key" ON "Applicant"("email");

-- CreateIndex
CREATE INDEX "Applicant_lastName_firstName_idx" ON "Applicant"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Applicant_region_idx" ON "Applicant"("region");

-- CreateIndex
CREATE UNIQUE INDEX "InsuredAsset_reference_key" ON "InsuredAsset"("reference");

-- CreateIndex
CREATE INDEX "InsuredAsset_applicantId_idx" ON "InsuredAsset"("applicantId");

-- CreateIndex
CREATE INDEX "InsuredAsset_assetType_idx" ON "InsuredAsset"("assetType");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_category_status_idx" ON "Product"("category", "status");

-- CreateIndex
CREATE INDEX "CoverageOption_productId_idx" ON "CoverageOption"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageOption_productId_code_key" ON "CoverageOption"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RiskFactor_code_key" ON "RiskFactor"("code");

-- CreateIndex
CREATE INDEX "RiskFactor_productId_metric_idx" ON "RiskFactor"("productId", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_reference_key" ON "Quote"("reference");

-- CreateIndex
CREATE INDEX "Quote_decision_status_idx" ON "Quote"("decision", "status");

-- CreateIndex
CREATE INDEX "Quote_applicantId_idx" ON "Quote"("applicantId");

-- CreateIndex
CREATE INDEX "Quote_productId_idx" ON "Quote"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteCoverage_quoteId_coverageOptionId_key" ON "QuoteCoverage"("quoteId", "coverageOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRiskFactor_quoteId_riskFactorId_key" ON "QuoteRiskFactor"("quoteId", "riskFactorId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_reference_key" ON "Policy"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_quoteId_key" ON "Policy"("quoteId");

-- CreateIndex
CREATE INDEX "Policy_status_idx" ON "Policy"("status");

-- CreateIndex
CREATE INDEX "Policy_applicantId_idx" ON "Policy"("applicantId");

-- CreateIndex
CREATE INDEX "Policy_assetId_effectiveFrom_idx" ON "Policy"("assetId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Endorsement_reference_key" ON "Endorsement"("reference");

-- CreateIndex
CREATE INDEX "Endorsement_policyId_status_idx" ON "Endorsement"("policyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Renewal_reference_key" ON "Renewal"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Renewal_resultingPolicyId_key" ON "Renewal"("resultingPolicyId");

-- CreateIndex
CREATE INDEX "Renewal_policyId_status_idx" ON "Renewal"("policyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UnderwritingDecision_reference_key" ON "UnderwritingDecision"("reference");

-- CreateIndex
CREATE INDEX "UnderwritingDecision_status_createdAt_idx" ON "UnderwritingDecision"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ValidationFinding_runId_severity_idx" ON "ValidationFinding"("runId", "severity");

-- CreateIndex
CREATE INDEX "ValidationFinding_issueCode_idx" ON "ValidationFinding"("issueCode");

-- CreateIndex
CREATE INDEX "AnomalyLabel_datasetLabel_idx" ON "AnomalyLabel"("datasetLabel");

-- CreateIndex
CREATE UNIQUE INDEX "AnomalyLabel_datasetLabel_anomalyCode_entityRef_key" ON "AnomalyLabel"("datasetLabel", "anomalyCode", "entityRef");

-- AddForeignKey
ALTER TABLE "InsuredAsset" ADD CONSTRAINT "InsuredAsset_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageOption" ADD CONSTRAINT "CoverageOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InsuredAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCoverage" ADD CONSTRAINT "QuoteCoverage_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCoverage" ADD CONSTRAINT "QuoteCoverage_coverageOptionId_fkey" FOREIGN KEY ("coverageOptionId") REFERENCES "CoverageOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRiskFactor" ADD CONSTRAINT "QuoteRiskFactor_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRiskFactor" ADD CONSTRAINT "QuoteRiskFactor_riskFactorId_fkey" FOREIGN KEY ("riskFactorId") REFERENCES "RiskFactor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InsuredAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_resultingPolicyId_fkey" FOREIGN KEY ("resultingPolicyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnderwritingDecision" ADD CONSTRAINT "UnderwritingDecision_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
