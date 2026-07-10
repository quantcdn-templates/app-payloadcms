import type { MetadataRoute } from 'next'

import { getServerSideURL } from '@/utilities/getURL'

// Runtime robots.txt, built from the deploy's actual URL. Replaces the
// build-time next-sitemap CLI output, which baked in the fallback
// https://example.com because NEXT_PUBLIC_SERVER_URL is unset at build time
// (this template builds without a database or environment configuration).
export default function robots(): MetadataRoute.Robots {
  const url = getServerSideURL()

  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/admin/*',
      },
    ],
    sitemap: [`${url}/pages-sitemap.xml`, `${url}/posts-sitemap.xml`],
  }
}
