"use server"

import { invalidateAfter } from "@/lib/cache/invalidate"
import type { ChangeEvent } from "@/lib/cache/tags"
import { getSession } from "@/lib/server/session"

const EVENTS: readonly ChangeEvent[] = ["invoice", "payment", "credit_note", "client", "item", "quote", "settings"]

/**
 * Called by the browser after a change it made through an API route (the
 * editor's autosave, clients, items, settings). Expires the user's cached
 * data, and because it's a Server Action that revalidates, the browser drops
 * its cached pages too, so going back to the dashboard shows the change.
 * Only ever touches the signed-in user's own tags.
 */
export async function syncAfterChange(events: ChangeEvent[]): Promise<void> {
  const session = await getSession()
  if (!session) return
  for (const e of new Set(events)) if (EVENTS.includes(e)) invalidateAfter(e, session.userId)
}
