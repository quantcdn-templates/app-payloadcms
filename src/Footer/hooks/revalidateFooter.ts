import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'
import { purgeEdgeCache } from '../../utilities/edgePurge'

export const revalidateFooter: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating footer`)

    revalidateTag('global_footer', 'max')
    purgeEdgeCache(payload.logger)
  }

  return doc
}
