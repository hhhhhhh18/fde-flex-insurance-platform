-- InsuranceLab master-data seed. Idempotent: safe to re-run.
BEGIN;
INSERT INTO "Product" (id, code, name, category, status, description, "baseRate", "minimumPremium", "maxCoverageLimit", "referralThreshold", "autoBindLimit", "minAssetValue", "maxAssetValue", "minApplicantAge", "maxApplicantAge", "effectiveFrom", "effectiveTo", "pricingVersion", "rulesVersion", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'CYB-GUARD', 'Cyber Guard SME', 'CYBER', 'ACTIVE', 'Cyber incident response and business interruption cover for small and mid-size enterprises.', '2.4', '300', '1000000', '15000', '400000', '10000', '1500000', 18, 85, '2024-06-01', NULL, 'cyber-2026.3', 'rules-2026.1', now(), now())
ON CONFLICT (code) DO NOTHING;
INSERT INTO "Product" (id, code, name, category, status, description, "baseRate", "minimumPremium", "maxCoverageLimit", "referralThreshold", "autoBindLimit", "minAssetValue", "maxAssetValue", "minApplicantAge", "maxApplicantAge", "effectiveFrom", "effectiveTo", "pricingVersion", "rulesVersion", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'LIA-FLEX', 'Professional Liability Flex', 'LIABILITY', 'ACTIVE', 'Professional indemnity cover available with or without a scheduled asset.', '1.2', '200', '1500000', '10000', '500000', '0', '3000000', 18, 85, '2024-01-01', NULL, 'liability-2026.1', 'rules-2026.1', now(), now())
ON CONFLICT (code) DO NOTHING;
INSERT INTO "Product" (id, code, name, category, status, description, "baseRate", "minimumPremium", "maxCoverageLimit", "referralThreshold", "autoBindLimit", "minAssetValue", "maxAssetValue", "minApplicantAge", "maxApplicantAge", "effectiveFrom", "effectiveTo", "pricingVersion", "rulesVersion", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'MOT-FLEET', 'Fleet Flex Motor', 'MOTOR', 'ACTIVE', 'Commercial and personal vehicle cover with collision, theft and third-party liability.', '3.2', '180', '500000', '12000', '250000', '5000', '300000', 18, 80, '2024-01-01', NULL, 'motor-2026.1', 'rules-2026.1', now(), now())
ON CONFLICT (code) DO NOTHING;
INSERT INTO "Product" (id, code, name, category, status, description, "baseRate", "minimumPremium", "maxCoverageLimit", "referralThreshold", "autoBindLimit", "minAssetValue", "maxAssetValue", "minApplicantAge", "maxApplicantAge", "effectiveFrom", "effectiveTo", "pricingVersion", "rulesVersion", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'PROP-SHIELD', 'Property Shield Commercial', 'PROPERTY', 'ACTIVE', 'Commercial property cover for buildings, machinery and solar assets.', '1.85', '240', '2000000', '18000', '750000', '20000', '3000000', 21, 85, '2024-03-01', NULL, 'property-2026.2', 'rules-2026.1', now(), now())
ON CONFLICT (code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'MOT-FLEET'), 'MOT-COL', 'Collision', 'COLLISION', '1', '10000', '300000', '60000', TRUE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'MOT-FLEET'), 'MOT-FIR', 'Fire', 'FIRE', '0.45', '5000', '200000', '35000', FALSE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'MOT-FLEET'), 'MOT-LIA', 'Third-party liability', 'GENERAL_LIABILITY', '0.3', '25000', '250000', '100000', TRUE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'MOT-FLEET'), 'MOT-THF', 'Theft', 'THEFT', '0.65', '5000', '200000', '40000', FALSE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'PROP-SHIELD'), 'PRP-BI', 'Business interruption', 'BUSINESS_INTERRUPTION', '0.55', '20000', '800000', '120000', FALSE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'PROP-SHIELD'), 'PRP-EQK', 'Earthquake', 'EARTHQUAKE', '0.9', '25000', '1000000', '150000', FALSE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'PROP-SHIELD'), 'PRP-FIR', 'Fire and allied perils', 'FIRE', '1', '50000', '2000000', '400000', TRUE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'PROP-SHIELD'), 'PRP-FLD', 'Flood', 'FLOOD', '0.75', '25000', '1000000', '200000', FALSE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'CYB-GUARD'), 'CYB-BI', 'Business interruption', 'BUSINESS_INTERRUPTION', '0.6', '25000', '500000', '100000', FALSE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'CYB-GUARD'), 'CYB-INC', 'Cyber incident response', 'CYBER_INCIDENT', '1', '50000', '1000000', '250000', TRUE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'CYB-GUARD'), 'CYB-LIA', 'Third-party liability', 'GENERAL_LIABILITY', '0.35', '25000', '500000', '100000', FALSE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'LIA-FLEX'), 'LIA-BI', 'Business interruption', 'BUSINESS_INTERRUPTION', '0.4', '20000', '500000', '80000', FALSE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'LIA-FLEX'), 'LIA-IND', 'Professional indemnity', 'GENERAL_LIABILITY', '1', '50000', '1500000', '300000', TRUE, TRUE, now())
ON CONFLICT ("productId", code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, NULL, 'AGE_10Y', 'Asset age over 10 years', 'ASSET_AGE_YEARS', 'GTE', '10', NULL, '1.15', FALSE, 'Older assets carry higher frequency and severity of loss.', TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, NULL, 'AGE_25Y', 'Asset age over 25 years', 'ASSET_AGE_YEARS', 'GTE', '25', NULL, '1.35', TRUE, 'Assets older than 25 years require individual underwriting review.', TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, NULL, 'CLAIMS_2', 'Two or more claims in 5 years', 'CLAIMS_HISTORY_5Y', 'GTE', '2', NULL, '1.25', FALSE, 'Claims frequency above the portfolio average.', TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, NULL, 'CLAIMS_3', 'Three or more claims in 5 years', 'CLAIMS_HISTORY_5Y', 'GTE', '3', NULL, '1.45', TRUE, 'Persistent claims history requires human underwriting judgement.', TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, NULL, 'COND_POOR', 'Poor asset condition', 'ASSET_CONDITION', 'EQ', NULL, 'POOR', '1.3', TRUE, 'Poor condition materially increases expected loss.', TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, NULL, 'CREDIT_D', 'Credit band D', 'CREDIT_BAND', 'EQ', NULL, 'D', '1.2', FALSE, 'Sub-prime credit band increases payment and fraud risk.', TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, NULL, 'CREDIT_E', 'Credit band E', 'CREDIT_BAND', 'EQ', NULL, 'E', '1.45', TRUE, 'Lowest credit band is not eligible for straight-through processing.', TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, (SELECT id FROM "Product" WHERE code = 'MOT-FLEET'), 'MOT_HIGH_VALUE', 'Motor asset value over 150,000', 'ASSET_VALUE', 'GTE', '150000', NULL, '1.2', TRUE, 'High-value vehicles need engineer inspection before binding.', TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, NULL, 'OCC_4', 'Occupation class 4', 'OCCUPATION_CLASS', 'GTE', '4', NULL, '1.15', FALSE, 'Highest-risk occupation grouping.', TRUE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, NULL, 'USE_COMM', 'Commercial usage', 'USAGE_TYPE', 'EQ', NULL, 'COMMERCIAL', '1.1', FALSE, 'Commercial exposure carries higher utilisation and liability.', TRUE)
ON CONFLICT (code) DO NOTHING;
COMMIT;
