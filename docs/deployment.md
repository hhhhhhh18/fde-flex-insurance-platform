# Deployment

Target: Vercel (Next.js) + a managed PostgreSQL provider (Neon, Supabase, Prisma Postgres, RDS…).
**No deployment has been performed from this repository.** The steps below are the prepared procedure; every
item marked *(manual)* requires credentials this environment does not have.

## 1. Create the database (manual)

1. Provision a PostgreSQL 15+ instance in the same region as the Vercel deployment.
2. Create a database (e.g. `fde_flex`) and an application role with DDL rights for migrations.
3. Collect two connection strings:
   - **pooled** (PgBouncer/Neon pooled endpoint) → `DATABASE_URL`
   - **direct** (non-pooled) → `DIRECT_URL`, used by `prisma migrate deploy`
4. Require TLS (`sslmode=require`) and restrict network access to Vercel egress or a private link.

## 2. Configure environment variables (manual)

Set in Vercel → Project → Settings → Environment Variables (Production and Preview):

| Key | Value |
| --- | --- |
| `DATABASE_URL` | pooled connection string |
| `DIRECT_URL` | direct connection string |
| `APP_ENV` | `production` |
| `DEMO_AUTH` | `false` unless you are running a controlled demo |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` |

Never commit these values. `.env*` is git-ignored; `.env.example` contains placeholders only.

## 3. Apply migrations (manual, once per environment)

Run from a trusted machine or CI step, **not** from the build command:

```bash
export DATABASE_URL="<direct-url>"
npx prisma migrate deploy
```

Rules:

- `migrate deploy` is additive and non-destructive; it never drops data.
- **Never** run `prisma migrate reset`, `db:seed`, or `data:generate --reset` against production.
- Before a destructive migration on an existing environment, take a provider snapshot and verify a restore path.
- `prisma migrate status` should report "Database schema is up to date" afterwards.

## 4. Seed the synthetic portfolio (manual, first deploy only)

```bash
export DATABASE_URL="<direct-url>"
npm run data:generate -- --reset --scale full --seed 20261001 --label baseline
```

The generator refuses to reset when `APP_ENV`/`NODE_ENV` is `production`. For a production demo, run it once
before flipping `APP_ENV=production`, or temporarily generate with `APP_ENV=staging` against an empty database.

## 5. Deploy

1. Push the repository to GitHub *(manual)*.
2. Import the repo in Vercel; the framework preset is detected automatically.
3. Build command `npm run build`; install command `npm ci`; Node 22.x.
4. Deploy. `postinstall` runs `prisma generate` so the client matches the schema at build time.
5. Confirm the deployment uses the pooled `DATABASE_URL` and that migrations were applied first.

## 6. Verify the live deployment

| Check | Expected |
| --- | --- |
| `GET /api/health` | `{"status":"ok","database":"connected",…}` with 200 |
| `GET /` | Dashboard KPIs > 0, three charts render |
| `GET /quotes` | Paginated list, filters work |
| `POST /api/quotes/evaluate` with invalid body | 422 with field paths |
| `POST /api/validation/run` as APPLICANT | 403 |
| `/api/exports/data?entity=policies&format=csv` | File download starts |
| Restart / redeploy | Record counts and dataset checksum unchanged (persistence) |

Record the dataset checksum before and after a redeploy (`npx tsx scripts/capture-evidence.ts`) — a changed
checksum on an untouched dataset indicates an unintended reset.

## 7. Operational notes

- Use a separate database for preview deployments; never point previews at production data.
- The health endpoint performs a `SELECT 1` plus two counts on every call — suitable for uptime checks, not for
  high-frequency synthetic monitoring.
- Backups: rely on the provider's PITR; the app has no export-based restore path.
- Rotate credentials by creating a new role, updating env vars, then revoking the old one.

## 8. What remains manual

- Database provisioning and network policy
- Vercel project creation, environment variables, domain
- Running migrations and the initial seed
- Any DNS/TLS configuration
- Replacing the demo role switcher with real authentication (see `docs/security.md`)
