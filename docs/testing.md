# Testing

Two layers: Vitest (unit + integration) and Playwright (end-to-end). Both were run against this build; the
numbers below are the actual output, not estimates.

## Commands

```bash
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint
npm test                     # vitest run  (unit + integration)
npm run test:unit            # vitest run tests/unit
npm run test:integration     # vitest run tests/integration
npm run test:e2e             # playwright test
```

Environment requirements:

- `TEST_DATABASE_URL` must be set. `vitest.config.ts` throws at startup if it is missing, so tests can never
  silently run against the operational database.
- Integration suites call `generateDataset({ reset: true })`, which truncates **only** the test database.
- Playwright accepts `E2E_DATABASE_URL` to point the preview server at a scratch database; without it the server
  uses `DATABASE_URL`. Use a scratch database if you do not want the evaluation test to add a quote.

## Last recorded results

```text
npx tsc --noEmit   → no errors
npm run lint       → 0 errors, 6 warnings (unused local variables in the generator, one React-Hook-Form compiler note)
npm run build      → ✓ Compiled successfully

npm test           → 7 files, 84 tests passed (46.6 s)
npm run test:e2e   → 13 tests passed (32.5 s)
```

## Coverage map

| File | Layer | Asserts |
| --- | --- | --- |
| `tests/unit/pricing.test.ts` | unit | Base rating, per-coverage factors, multiplier product, 0.5 factor floor, minimum premium, HALF_UP rounding to 2dp, determinism for identical input, coverage limits (above max / below min), mandatory coverages, cross-product coverage, unknown codes, age band edges, asset value band, asset-type mismatch, retired/out-of-window products, missing risk data, referral thresholds (premium, auto-bind, factor flag), clean risk not referred |
| `tests/unit/lifecycle.test.ts` | unit | Valid and invalid transitions for all five machines, terminal states, error messages naming both states |
| `tests/unit/exports.test.ts` | unit | CSV header/order, RFC 4180 escaping, null cells, repeatability; canonical JSON key sorting, array order, SHA-256 stability, per-entity checksums + dataset digest |
| `tests/unit/sql-export.test.ts` | unit | Master-data SQL transaction wrapper, 3 insert groups, `ON CONFLICT` idempotency, quote escaping, NULL product scope, byte-identical output, empty dataset |
| `tests/unit/schemas.test.ts` | unit | Quote request acceptance/rejection, money format, coverage cap, pagination clamps, cancellation reason, endorsement types, renewal term bounds, reviewer notes, export format allow-list |
| `tests/integration/data-integrity.test.ts` | integration | Same seed → identical counts, checksums and canonical JSON; different seed → different checksum; every entity exported; no orphan FKs; unique references; all injected anomalies detected; identical findings when labels are withheld (ground-truth separation); finding evidence/remediation present; export projection omits surrogate ids and timestamps; references stable across regenerations; label resolution fallback |
| `tests/integration/workflows.test.ts` | integration | Quote persistence + audit; missing applicant; issuance blocked by role, payment, duplicate, unapproved referral, authority, overlap; underwriting role + authority + approval identity; endorsement on cancelled policy, limit above option max, applied limit change updates premium; renewal refusal for cancelled policy, single offer starting after expiry, accepted offer creates successor; FK and unique-constraint enforcement |
| `tests/e2e/dashboard.spec.ts` | e2e | Dashboard KPIs, three chart surfaces, accessible chart label, no starter-page remnants, navigation to all ten sections |
| `tests/e2e/records.spec.ts` | e2e | Applicant search + detail navigation, quote pagination preserves page, asset type filter |
| `tests/e2e/quoting.spec.ts` | e2e | Full evaluation flow persists a quote (count +1), result panel sections, client-side validation blocks submit |
| `tests/e2e/operations.spec.ts` | e2e | Underwriting read-only for applicants vs actionable for reviewers, exception filters + evidence, reports totals + CSV download + SQL/JSON export |
| `tests/e2e/security.spec.ts` | e2e | Applicant gets 403 on issue/decide/validate, health leaks no DSN, malformed payload → 422, unknown resource → 404 without internals |

## Determinism test design

`data-integrity.test.ts` generates the dataset twice in the same test database and compares:

1. `counts` per entity,
2. canonical JSON of the full projection (sorted keys, reference-keyed rows, dates normalised to `YYYY-MM-DD`),
3. per-entity SHA-256 checksums plus a combined dataset digest.

Timestamps such as `manifest.generatedAt` are excluded, as are surrogate ids. A second test regenerates with a
different seed and asserts the digest changes, so the check cannot pass vacuously.

## Reproducing the cross-database check

The integration test proves determinism within one database. The stronger, two-database check is:

```bash
# database A
npm run data:generate -- --reset --scale small --seed 20261001 --label repro-a
npm run data:export   -- --label repro-a --out data/repro/run-a

# database B (separate database, same seed)
npm run data:generate -- --reset --scale small --seed 20261001 --label repro-b
npm run data:export   -- --label repro-b --out data/repro/run-b

npm run data:compare -- data/repro/run-a data/repro/run-b
```

Recorded result: 11 checksums and all deterministic files matched byte-for-byte; dataset checksum
`b2f5dc44ce293035f3f7573ae36060d4cf07bd3a1796007fb705e3efad956706`.

## Known testing gaps

- No coverage instrumentation (`@vitest/coverage-v8` is installed but no threshold is enforced).
- No load/performance tests.
- No visual regression snapshots.
- E2E covers the primary workflows, not every form field combination.
- Playwright runs with one worker against one database; suites are not parallelised.
