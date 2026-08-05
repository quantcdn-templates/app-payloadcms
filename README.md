# Payload CMS on Quant Cloud

[![Deploy to Quant Cloud](https://img.shields.io/badge/Deploy%20to-Quant%20Cloud-blue?style=for-the-badge)](https://dashboard.quantcdn.io/deploy/step-one?template=app-payloadcms)

[Payload](https://payloadcms.com/) is a code-first headless CMS built on Next.js. This template deploys Payload 3 (official website starter) on Quant Cloud with PostgreSQL — pages, posts, media library, live preview, and SEO tooling out of the box.

## Architecture

- Next.js 16 standalone build on Node 24 behind the Quant proxy (app on port 3001, proxy on 3000)
  - Node 24 is required if you enable Next 16's Cache Components (`cacheComponents: true`) — its runtime is broken on Node 22. Cache Components also rejects empty `generateStaticParams`, which is why this template builds with `--experimental-build-mode compile`
- PostgreSQL via `@payloadcms/db-postgres` — works with Quant managed Postgres or your own RDS instance
- Media uploads stored on a persistent volume (EFS on Quant Cloud) at `MEDIA_DIR`
- No database needed at build time: pages render on first request and are cached (ISR); Payload's publish hooks revalidate changed pages automatically
- Schema migrations apply automatically at boot (`prodMigrations`); a failed migration fails the deploy loudly
- Publishing content purges the edge cache, so changes appear immediately rather than after the CDN TTL (requires `QUANT_PURGE_*`)
- Next's optimised-image and data caches live on the persistent volume, so they survive deploys and restarts instead of every image being re-optimised with sharp on first request
- Task sized at 512 CPU / 1024MB via `x-quant-labels` in `docker-compose.yml` — the platform default of 256/512 is too small for sharp image optimisation (the task gets killed by health checks). Adjust there if your site is heavier

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PAYLOAD_SECRET` | Secret for auth tokens/sessions (`openssl rand -base64 32`) | Yes |
| `DATABASE_URI` | Full Postgres connection string (takes precedence; `DATABASE_URL` is accepted as an alias) | One of these |
| `DB_HOST` / `DB_PORT` / `DB_DATABASE` / `DB_USERNAME` / `DB_PASSWORD` | Injected by Quant Cloud managed Postgres; assembled into a connection string automatically | One of these |
| `DB_SSL` | Set `true` for TLS-enforcing databases (e.g. RDS) when using `DB_*` vars | No |
| `MEDIA_DIR` | Upload directory (default `/data/media`) | No |
| `QUANT_SMTP_HOST` / `QUANT_SMTP_PORT` / `QUANT_SMTP_USERNAME` / `QUANT_SMTP_PASSWORD` / `QUANT_SMTP_FROM` | SMTP relay for Payload emails (password resets etc.). Unset = emails are logged, not sent. Generic `SMTP_*` names also accepted. Port 465 = implicit TLS | No |
| `QUANT_PURGE_TOKEN` / `QUANT_PURGE_ORG` / `QUANT_PURGE_PROJECT` | Purge the edge cache when content changes. All three required to enable; unset = no purging. Token needs the `content:purge` scope | No |
| `QUANT_PURGE_ENDPOINT` | Purge API base (default `https://dashboard.quantcdn.io/api/v1`; QuantGov: `https://dash.quantgov.cloud/api/v1`) | No |
| `NEXT_CACHE_PERSIST` / `NEXT_CACHE_DIR` | Persist Next's image + data caches on the volume (default on, at `/data/next-cache`). Set `NEXT_CACHE_PERSIST=false` to opt out | No |
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
