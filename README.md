# Payload CMS on Quant Cloud

[![Deploy to Quant Cloud](https://img.shields.io/badge/Deploy%20to-Quant%20Cloud-blue?style=for-the-badge)](https://dashboard.quantcdn.io/deploy/step-one?template=app-payloadcms)

[Payload](https://payloadcms.com/) is a code-first headless CMS built on Next.js. This template deploys Payload 3 (official website starter) on Quant Cloud with PostgreSQL — pages, posts, media library, live preview, and SEO tooling out of the box.

## Architecture

- Next.js 15 standalone build behind the Quant proxy (app on port 3001, proxy on 3000)
- PostgreSQL via `@payloadcms/db-postgres` — works with Quant managed Postgres or your own RDS instance
- Media uploads stored on a persistent volume (EFS on Quant Cloud) at `MEDIA_DIR`
- No database needed at build time: pages render on first request and are cached (ISR); Payload's publish hooks revalidate changed pages automatically
- Schema migrations apply automatically at boot (`prodMigrations`); a failed migration fails the deploy loudly

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PAYLOAD_SECRET` | Secret for auth tokens/sessions (`openssl rand -base64 32`) | Yes |
| `DATABASE_URI` | Full Postgres connection string (takes precedence; `DATABASE_URL` is accepted as an alias) | One of these |
| `DB_HOST` / `DB_PORT` / `DB_DATABASE` / `DB_USERNAME` / `DB_PASSWORD` | Injected by Quant Cloud managed Postgres; assembled into a connection string automatically | One of these |
| `DB_SSL` | Set `true` for TLS-enforcing databases (e.g. RDS) when using `DB_*` vars | No |
| `MEDIA_DIR` | Upload directory (default `/data/media`) | No |
| `NEXT_PUBLIC_SERVER_URL` | Public URL of the site (used for live preview/SEO links) | Recommended |

## Local Development

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
docker compose up -d
# Admin UI: http://localhost:3000/admin  (create the first user on first visit)
```

Or without Docker (needs a local Postgres):

```bash
npm install
DATABASE_URI=postgresql://payload:payload@localhost:5432/payload \
PAYLOAD_SECRET=dev-secret npm run dev
```

## Schema Changes

Dev mode pushes schema changes automatically. Before deploying schema changes, generate and commit a migration:

```bash
npm run payload migrate:create my_change
git add src/migrations && git commit -m "feat: my_change migration"
```

Migrations apply automatically when the container boots.

## Migrating from Vercel + Supabase

Supabase's database is standard PostgreSQL, so a Payload site migrates cleanly:

1. **Adapter:** if your `payload.config.ts` uses `@payloadcms/db-vercel-postgres`, switch to `@payloadcms/db-postgres` (same schema; config shape matches this template).
2. **Database:** dump from Supabase using the **direct** connection (port 5432, not the Supavisor pooler on 6543), restore into your Quant/RDS Postgres:
   ```bash
   pg_dump --clean --if-exists --schema=public "$SUPABASE_DIRECT_URI" > payload.sql
   psql "$DATABASE_URI" < payload.sql
   ```
   Only the `public` schema moves — Supabase-owned schemas (`auth`, `storage`, etc.) stay behind.
3. **Media:** copy your upload files into the persistent media volume (or configure `@payloadcms/storage-s3`).
4. **Env vars:** map your Supabase/`POSTGRES_URL` connection to `DATABASE_URI`; keep `PAYLOAD_SECRET` identical so existing sessions and API keys keep working.
5. **Check for direct Supabase feature usage** in app code — each needs replacing if present: `supabase.auth` (→ Payload auth or another provider), `supabase.storage` (→ Payload uploads/S3), `supabase.from(...)` PostgREST queries (→ Payload local API/REST), Realtime subscriptions, Edge Functions (→ Next.js routes).

## Notes

- **Scheduled publishing** uses Payload's jobs queue; trigger `/api/payload-jobs/run` on a schedule (e.g. external cron) with `CRON_SECRET` set if you use it.
- **Multiple replicas:** the page cache is per-container; publish-time revalidation reaches the replica serving the admin request. Single-instance deployments (default) are unaffected — for multi-replica, add a time-based `revalidate` window.

## Deployment

Push to `main` (production) or `develop` (staging). Configure repository secrets `QUANT_API_KEY` and `QUANT_ORGANIZATION`. Optional repo variables: `RUNNER_TYPE`, `BUILD_PLATFORM`, `QUANT_BASE_URL` (QuantGov: `https://dash.quantgov.cloud/api/v3`).
