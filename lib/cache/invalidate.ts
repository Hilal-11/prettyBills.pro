import "server-only"

import { revalidateTag, updateTag } from "next/cache"

import { getSession } from "@/lib/server/session"

import { tagsFor, type ChangeEvent, type ChangeIds } from "./tags"

/**
 * After a change: expire the user's server-cached data for it, immediately.
 *
 * In a Server Action this uses updateTag, which also tells the browser to
 * drop its whole page cache (Next's client cache), so the next page shows
 * the change (read-your-own-writes). Don't call refresh() after it: that
 * would downgrade the client invalidation to the current page only.
 */
export function invalidateAfter(event: ChangeEvent, userId: string, ids: ChangeIds = {}) {
  for (const t of tagsFor(event, userId, ids)) updateTag(t)
}

/** The same, for Server Actions that only have the request's session. */
export async function afterChange(event: ChangeEvent, ids: ChangeIds = {}) {
  const session = await getSession()
  if (session) invalidateAfter(event, session.userId, ids)
}

/**
 * Route Handlers can't use updateTag. This expires the server cache with no
 * stale window ({ expire: 0 }); the browser then calls the syncAfterChange
 * action (lib/client/sync) to drop its page cache too.
 */
export function invalidateFromRoute(event: ChangeEvent, userId: string, ids: ChangeIds = {}) {
  for (const t of tagsFor(event, userId, ids)) revalidateTag(t, { expire: 0 })
}
