# Security review

Scope: this repository, with synthetic data only. No penetration test, dependency audit beyond `npm audit`,
or infrastructure review was performed.

## 1. Identity — read this first

The application ships with a **demo identity switch**. `POST /api/session/role` writes an httpOnly cookie
(`ilab_role`) and every server action authorizes against that role. This is **not authentication**:

- anyone who can reach the app can assume any role;
- there is no credential, session revocation, MFA or audit of sign-in;
- the cookie is `httpOnly`, `SameSite=Lax`, `Secure` in production, valid 8 hours.

Mitigation implemented: setting `DEMO_AUTH=false` makes the POST return **403 DEMO_AUTH_DISABLED** and the UI
renders "SSO required" instead of the selector. With demo auth off and no real IdP the app resolves to
**APPLICANT**, which can read but not mutate.

**Before any deployment with real data:** integrate an IdP-backed session, map its claims to `Role`, delete the
demo endpoint, and keep the server-side checks below unchanged.

## 2. Authorization matrix

| Permission | APPLICANT | OPERATIONS_ANALYST | RISK_REVIEWER | ADMIN |
| --- | --- | --- | --- | --- |
| `quote:evaluate` | yes | yes | yes | yes |
| `policy:issue`, `policy:cancel` | — | yes | — | yes |
| `endorsement:submit` / `endorsement:decide` | — | yes | yes | yes |
| `renewal:generate` / `renewal:respond` | — | yes | — | yes |
| `underwriting:decide` | — | — | yes | yes |
| `validation:run` | — | yes | yes | yes |
| `export:read` | yes | yes | yes | yes |
| `data:generate` | — | — | — | yes |

Monetary authority (maximum premium an actor may bind/approve, USD):

| Role | Limit |
| --- | --- |
| APPLICANT | 0 |
| OPERATIONS_ANALYST | 25,000 |
| RISK_REVIEWER | 250,000 |
| ADMIN | 1,000,000 |

Enforced in `checkAuthority()` and applied at policy issuance, underwriting approval, policy activation and
endorsement approval (`premiumDelta`). Exceeding authority raises `AuthorizationError` → **403**.

## 3. Endpoint review

| Endpoint | Guard | Authority | Notes |
| --- | --- | --- | --- |
| `POST /api/quotes/evaluate` | `quote:evaluate` | — | Zod validated, coverages capped at 20 |
| `POST /api/policies/issue` | `policy:issue` | yes | requires eligible/approved quote + confirmed payment + no overlap |
| `POST /api/policies/activate` | `policy:issue` | yes | payment required |
| `POST /api/policies/cancel` | `policy:cancel` | — | reason required, state machine enforced |
| `POST /api/endorsements` | `endorsement:submit` | — | term bounds, option limits, re-priced delta |
| `POST /api/endorsements/[id]/decision` | `endorsement:decide` | yes | approval cannot skip APPLIED transition |
| `POST /api/renewals/generate` | `renewal:generate` | — | cancelled policies rejected |
| `POST /api/renewals/[id]/respond` | `renewal:respond` | — | single response, expiry checked |
| `POST /api/underwriting/decisions` | `underwriting:decide` | yes | reviewer identity + authority recorded |
| `POST /api/validation/run` | `validation:run` | — | read-only over operational tables |
| `POST /api/session/role` | demo only | — | disabled with `DEMO_AUTH=false` |
| `GET /api/exports/data` | `export:read` | — | `entity` allow-listed |
| `GET /api/health` | public | — | counts + latency only |

All guards live in the **service layer**, so a new route cannot bypass them by forgetting to call
`assertAuthorized`. Verified by `tests/e2e/security.spec.ts` and `tests/integration/workflows.test.ts`
(role denial, authority denial, payment prerequisite, double issuance, overlap).

## 4. Input handling

- Every request body/query is parsed by a Zod schema (`src/lib/validation/schemas.ts`); failures return **422**
  with field paths.
- Request bodies are capped at **64 KB** (`Content-Length` check) → **413**.
- Pagination is clamped to 100 rows; page numbers are bounded.
- Coverage lines are capped at 20 per quote; money must match `^\d{1,12}(\.\d{1,2})?$`.
- Unknown enum values, malformed dates and negative amounts are rejected before any service call.

## 5. Error handling and data exposure

`src/lib/api/http.ts` maps domain errors to structured JSON (`{error:{code,message,details}}`) and returns a
generic **500** for unexpected failures. Stack traces, Prisma messages and connection strings are never sent to
clients. Framework prerender signals are re-thrown rather than converted into 500s.

`/api/health` reports status, latency and row counts — no DSN, no schema, no environment values.
Read endpoints expose only synthetic business data. Ground-truth labels are returned only by
`/api/validation/latest?includeGroundTruth=true`, which is an evaluation/reporting surface, not a detector input.

## 6. Secrets

- `.env` is git-ignored via `.env*`; only `.env.example` with placeholders is committed.
- No secret is read through `NEXT_PUBLIC_*`; nothing sensitive reaches the client bundle.
- Database credentials exist only in server environment variables.

## 7. Residual risks / accepted gaps

| Risk | Status |
| --- | --- |
| Demo role switcher usable by anyone | Accepted for the demo; disable with `DEMO_AUTH=false` |
| No CSRF token | Mitigated only by `SameSite=Lax`; add tokens with real auth |
| No rate limiting | Not implemented; add at the edge for public deployment |
| Audit table append-only by convention | No DB trigger prevents UPDATE/DELETE by a privileged user |
| SQL export limited to master data | By design |
| No row-level tenancy | Single-tenant demo |

## 8. Manual verification

1. Set role to APPLICANT, then `curl -X POST /api/policies/issue` with a valid quote id → expect **403**.
2. Set role to OPERATIONS_ANALYST and attempt to issue a quote above 25,000 → expect **403** with an authority message.
3. `curl /api/health` → confirm no connection string appears in the body.
4. `curl -X POST /api/validation/run` as APPLICANT → **403**.
5. Start with `DEMO_AUTH=false` → the header shows "SSO required" and role changes return **403**.
