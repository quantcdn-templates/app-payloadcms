import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'
import { purgeEdgeCache } from '../../utilities/edgePurge'

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating header`)

    revalidateTag('global_header', 'max')
    purgeEdgeCache(payload.logger)
  }

  return doc
}
