import type { CollectionAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'
import { purgeEdgeCache } from '../utilities/edgePurge'

export const revalidateRedirects: CollectionAfterChangeHook = ({ doc, req: { payload } }) => {
  payload.logger.info(`Revalidating redirects`)

  revalidateTag('redirects', 'max')
  purgeEdgeCache(payload.logger)

  return doc
}
