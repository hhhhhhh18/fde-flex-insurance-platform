# Anomaly labels and ground truth

The generator produces two outputs in one pass: a clean baseline and a **controlled** set of labelled defects.
Defects are never produced by random corruption — each one is a deliberate, named mutation applied after the
baseline is written, and each writes a ground-truth row.

## The seven labelled anomalies

| # | Anomaly code | Entity | Injection | Expected issue code | Severity |
| --- | --- | --- | --- | --- | --- |
| 1 | `ANOM_PREMIUM_MISMATCH` | Quote | Gross premium inflated by 5% on an otherwise valid quote | `PRM_FORMULA_MISMATCH` | CRITICAL |
| 2 | `ANOM_UNAUTHORIZED_ISSUANCE` | Policy | Active policy on a referred quote, issued by APPLICANT with unpaid premium | `LIFECYCLE_INVALID` | CRITICAL |
| 3 | `ANOM_COVERAGE_LIMIT` | Quote | Coverage line pushed above its option maximum | `COV_LIMIT_EXCEEDED` | CRITICAL |
| 4 | `ANOM_INVALID_RENEWAL` | Renewal | Renewal offer attached to a cancelled policy | `RNW_INVALID_RELATIONSHIP` | HIGH |
| 5 | `ANOM_OVERLAP` | Policy | Second active policy overlapping an existing one on the same asset | `POL_OVERLAP` | CRITICAL |
| 6 | `ANOM_RISK_INFO_IGNORED` | InsuredAsset | Risk data cleared after the quote was priced as eligible | `DQ_RISK_INFO_MISSING` | HIGH |
| 7 | `ANOM_DATE_INVERSION` | Policy | End date set 30 days before the start date | `DATE_ORDER_INVALID` | CRITICAL |

Anomaly 2 legitimately yields **two** findings (unpaid active policy *and* issuance without approval). The
evaluation links both to the same label, which is why 7 labels can produce 8 findings without any finding being
unexplained.

## Ground-truth record

```json
{
  "datasetLabel": "baseline",
  "anomalyCode": "ANOM_PREMIUM_MISMATCH",
  "entityType": "Quote",
  "entityRef": "QTE-2026-00002",
  "expectedIssue": "PRM_FORMULA_MISMATCH",
  "description": "Gross premium inflated by 5% after pricing."
}
```

Stored in `AnomalyLabel`, unique on `(datasetLabel, anomalyCode, entityRef)`.

## Separation from detection

- `src/lib/validation/checks.ts` never queries `AnomalyLabel`. Detection is a pure function of operational data.
- `src/lib/validation/runner.ts` runs every check first, then — in the reporting phase only — joins findings to
  labels by `(issueCode, entityRef)` and computes detected/missed/unexplained.
- `tests/integration/data-integrity.test.ts` asserts that findings are byte-identical when labels are withheld
  (`datasetLabel: "all"` with none present), which is the executable proof of separation.
- The UI's exception explorer consumes the same join for display; it does not influence detection.

## Evaluation output

`runValidation()` returns, alongside findings:

```json
{
  "labels": [{ "anomalyCode": "...", "entityRef": "...", "expectedIssue": "...", "detected": true }],
  "detectedCount": 7,
  "missedCount": 0,
  "unlabelledFindings": [],
  "precision": 1,
  "recall": 1
}
```

`precision` is the share of findings that map to a label; `recall` is the share of labels that were detected.

## Label resolution

Ground truth is scoped by `datasetLabel`. If a run is requested with a label that has no rows (for example the
UI default `operational` against a dataset generated as `baseline`), the runner falls back to the most recent
label set and records the resolved label on the run. This is covered by a regression test — before the fix, all
findings were reported as unexplained.

## Regenerating

```bash
npm run data:generate -- --reset --scale small --seed 20261001 --label my-dataset
npm run data:validate -- --label my-dataset
```

Anomalies are omitted with `--no-anomalies`; the validator then expects zero findings and the run status is PASS.

## Limits

The label set covers the defect classes the assessment asked for, not every possible integrity failure.
Checks additionally cover duplicates, orphans, enum drift and monetary reconciliation, which the generator cannot
create without violating database constraints — those paths are exercised by integration tests instead.
