# AI usage disclosure

## Disclosure

This project was built with an AI coding assistant (Accio Work) acting as engineer, reviewer and technical
writer. The human owner reviewed and approved each phase, supplied the requirements, and is responsible for
acceptance. No proprietary or third-party source code was copied; all dependencies are public npm packages.

The assistant did **not** deploy, push to GitHub, or create cloud resources. No external credentials were
available or used.

## Prompt history

| # | Request | Outcome |
| --- | --- | --- |
| 1 | Build a production-quality insurance operations platform (TypeScript, Next.js, PostgreSQL, Prisma) with synthetic data, configurable rules, pricing, underwriting, lifecycle, validation, audit, analytics and reproducible exports | Backend, schema, generator, validation, exports, REST API |
| 2 | Audit the frontend without modifying files; explain why `localhost:3000` showed the Next.js starter | Audit found no UI had been built |
| 3 | Approve Phase 1: app shell + dashboard | Design tokens, shell, KPI cards, three charts, dashboard API wiring |
| 4 | Approve Phase 2: record tables and detail views for seven entities | Lists, filters, pagination, detail views, four read-only detail endpoints |
| 5 | Approve Phase 3: quote evaluation, underwriting queue, exception explorer, reports/exports | Four workbenches, SQL export, decision actions |
| 6 | Approve Phase 4: testing, security review, documentation, deployment readiness | Test suites, security review, docs, reproducibility evidence |

Each prompt was executed in small stages with intermediate verification (type checks, builds, live API probes,
browser checks) before moving on.

## Generated vs. executed

AI-authored artifacts: schema, migrations, service layer, pricing engine, rules, generator, validators, exporters,
API routes, UI components and pages, test suites, documentation.

Claims in this repository are backed by commands actually run in this workspace:

| Claim | Evidence |
| --- | --- |
| 84 Vitest tests pass | `npm test` → 7 files, 84 tests |
| 13 E2E tests pass | `npm run test:e2e` → 13 passed |
| Production build succeeds | `npm run build` → compiled successfully |
| Lint and types are clean | `npm run lint` (0 errors), `npx tsc --noEmit` (no output) |
| Generation is deterministic | Two independent databases at seed 20261001 → identical checksums, byte-identical exports |
| All 7 anomalies are detected | Validation run: 7/7 labels matched, 0 unexplained findings |
| Demo dataset state | `scripts/capture-evidence.ts` snapshot + `data/evidence/*.json` |

## What the owner should verify personally

1. **Business rules** — that the rating formula, referral thresholds and authority limits match the intended
   insurance practice. The implementation is internally consistent and tested, but the parameters are illustrative.
2. **Security posture** — that "demo identity" is acceptable for the review context and that the deployment plan
   replaces it with real authentication.
3. **Dataset realism** — distributions are plausible, not actuarially calibrated.
4. **Deployment** — credentials, managed database, migrations and DNS were not exercised here.
5. **Test adequacy** — coverage targets the assessment's checklist; it is not exhaustive.

## Known AI-introduced issues found and fixed during the work

- `export const dynamic = "force-dynamic"` was incompatible with Next 16 Cache Components and returned 500s.
- The API error wrapper swallowed Next's prerender bailout signals, turning them into 500s at build time.
- The quote detail page rendered against a stale payload shape (`minimumApplied`, string `rounding`, coverage
  `code`) and showed blanks or `[object Object]`.
- Ground truth was scoped by dataset label, so the UI's default label left every finding "unexplained".
- PowerShell's `$var?query` interpolation produced a malformed database URL; the generator's safety guard
  correctly refused to truncate, preventing damage.

Each is documented in the commit history of this conversation and covered by a test where practical.
