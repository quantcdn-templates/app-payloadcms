import 'server-only'

/**
 * Edge cache purging for Quant Cloud.
 *
 * Payload's revalidate hooks clear Next's own cache, but the Quant edge keeps
 * serving cached HTML until its TTL lapses — so an editor publishes a change,
 * reloads the site and still sees the old page. Purging the edge when content
 * changes closes that gap.
 *
 * Purges `/*` by default: one change can affect navigation, listings, related
 * posts and sitemaps, so path-targeting risks leaving something stale. The cost
 * is low, because Next's route cache still serves every page whose path/tag was
 * not revalidated — only genuinely changed pages re-render at the origin.
 *
 * No-ops unless QUANT_PURGE_TOKEN, QUANT_PURGE_ORG and QUANT_PURGE_PROJECT are
 * all set, so local development and unconfigured environments are unaffected.
 *
 * The token needs the `content:purge` scope (or legacy `projects:write`).
 */

const PURGE_TIMEOUT_MS = 8000

type PurgeLogger = {
  info: (msg: string) => void
  error: (msg: string) => void
}

type PurgeConfig = {
  token: string
  organisation: string
  project: string
  endpoint: string
}

function getPurgeConfig(): PurgeConfig | null {
  const token = process.env.QUANT_PURGE_TOKEN
  const organisation = process.env.QUANT_PURGE_ORG
  const project = process.env.QUANT_PURGE_PROJECT
  const endpoint = (
    process.env.QUANT_PURGE_ENDPOINT || 'https://dashboard.quantcdn.io/api/v1'
  ).replace(/\/$/, '')

  if (!token || !organisation || !project) return null
  return { token, organisation, project, endpoint }
}

/**
 * Purges the edge cache. Never throws and never blocks the caller: a CDN
 * outage must not make content saves fail or hang in the admin panel.
 */
export function purgeEdgeCache(logger?: PurgeLogger, path = '/*'): void {
  // Seeding writes many documents; purging per document would be pointless.
  if (process.env.PAYLOAD_SEEDING === 'true') return

  const config = getPurgeConfig()
  if (!config) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PURGE_TIMEOUT_MS)

  void fetch(`${config.endpoint}/purge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Quant-Organisation': config.organisation,
      'Quant-Project': config.project,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        logger?.error(`[edge-purge] Purge failed (HTTP ${response.status}): ${body.slice(0, 200)}`)
        return
      }
      logger?.info(`[edge-purge] Purged "${path}" for project ${config.project}`)
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      logger?.error(`[edge-purge] Purge request failed: ${message}`)
    })
    .finally(() => clearTimeout(timeout))
}
