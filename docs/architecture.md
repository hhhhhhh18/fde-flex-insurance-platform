# Architecture

## Summary

FDE Flex is a single Next.js application (App Router) backed by PostgreSQL through Prisma. There is no separate API service, message broker or background worker. Every number shown in the UI is produced by a server-side service and stored before it is displayed.

```
Browser
  │  HTML (server components)          fetch (client components, JSON)
  ▼                                      ▼
Next.js route handlers  ───────►  services/*  ───────►  Prisma  ───────►  PostgreSQL
        │                              │
        │                              ├── lib/pricing        (pure, no I/O)
        │                              ├── lib/business-rules (pure, no I/O)
        │                              ├── lib/lifecycle      (pure state machines)
        │                              └── lib/audit          (append-only events)
        │
        └── lib/validation     (dataset checks, anomaly detection)
            lib/generator      (seeded synthetic data)
            lib/exports        (CSV / JSON / SQL projections)
            lib/analytics      (dashboard aggregates)
```

## Layers and responsibilities

| Layer | Location | Responsibility |
|---|---|---|
| Presentation | `src/app/**/page.tsx`, `src/components/**` | Server components fetch through the app's own REST API; client components handle interaction only. No business rules. |
| HTTP | `src/app/api/**/route.ts` | Parse and validate input with Zod, resolve the acting role, call a service, map errors to status codes. |
| Services | `src/services/*.ts` | Transactions, authorization, lifecycle guards, audit writing. |
| Domain | `src/lib/pricing`, `src/lib/business-rules`, `src/lib/lifecycle` | Pure functions with no Prisma or React imports. This is what unit tests exercise. |
| Persistence | `src/lib/db.ts`, `prisma/schema.prisma` | Typed access, constraints, indexes, referential integrity. |
| Data tooling | `src/lib/generator`, `src/lib/validation`, `src/lib/exports` | Deterministic dataset creation, integrity checks, reproducible artifacts. |

## Key design decisions

**One pricing implementation.** `src/lib/pricing/engine.ts` is the only place a premium is computed. Services, the synthetic generator and the validator all call it. The validator re-runs it against the stored `inputSnapshot`, which is how premium tampering is detected without relying on current configuration.

**Pricing snapshots over re-derivation.** Each quote stores the full input (`product` config, applicant facts, asset facts, coverage config, risk factors, `asOf`) plus every intermediate value. Later configuration changes cannot retroactively change a historic premium, and a validator can reproduce the exact number.

**Decimal money, never floats.** `decimal.js` is used for all arithmetic. Intermediate rating values keep 6dp; the payable premium is rounded `HALF_UP` to 2dp exactly once. Prisma maps money to `NUMERIC(14,2)`.

**Business identifiers separate from primary keys.** Internal IDs are cuids; users see `QTE-2026-00032`. References come from an atomic `Counter` row inside the same transaction that creates the record, so concurrent requests cannot duplicate a reference.

**Append-only audit.** `AuditEvent` rows are written inside the same transaction as the state change. There is no update or delete path in the application; history is never rewritten.

**Explicit state machines.** `src/lib/lifecycle/state-machine.ts` declares allowed transitions for quotes, policies, endorsements, renewals and underwriting. Invalid transitions throw before any write.

**Authorization in services, not components.** Every mutating service begins with `assertAuthorized(role, permission)` and monetary checks. Route handlers cannot bypass it, and the UI is not a security boundary.

**Ground truth is separate.** Injected anomalies are recorded in `AnomalyLabel`, which no validator reads. Evaluation joins labels to findings only after detection. A test deletes all labels and confirms identical findings.

**Deterministic generation.** A seeded PRNG (mulberry32) plus a fixed dataset anchor date drives all randomness. Exports project a fixed field list, sorted by business reference, with keys serialized canonically; `Id`/`createdAt` never appear in exported artifacts.

## Request lifecycle (mutation)

1. Route handler validates the body with a Zod schema and enforces a 64 KB body cap.
2. The acting role is read from the demo cookie and mapped to the `Actor` used by services.
3. The service re-checks the permission and, where relevant, the monetary authority for the amount involved.
4. Domain rules run (pricing, eligibility, lifecycle).
5. A Prisma transaction writes the record, related rows, the audit event and any counter increment.
6. Domain errors map to 403/404/409/422 with a structured body; unexpected errors return a generic 500 with no stack trace.

## Trade-offs and boundaries

- **Server components call the app's own HTTP API** (through `apiGet`) rather than importing services directly, so the UI exercises the same contract as external clients. The cost is one extra internal request per page.
- **No background jobs.** Renewal expiry and policy expiry are represented as states computed at generation time; a production deployment would add a scheduler.
- **Demo identity.** The role cookie is a demonstration control, not authentication (see `security.md`).
- **Single-tenant.** No `tenantId` columns; row-level isolation would be required for multi-tenancy.
