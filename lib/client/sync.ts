"use client"

import { syncAfterChange } from "@/app/(app)/cache-actions"
import type { ChangeEvent } from "@/lib/cache/tags"

import { getQueryClient } from "./query"

/**
 * After a change made through an API route (autosave, clients, items,
 * settings): drop every cached copy of the user's data, so the next page
 * shows it. The browser's query cache is marked stale at once; the server
 * cache and Next's cached pages via one Server Action. Bursts (typing, then
 * autosave) are batched into one call.
 */
const pending = new Set<ChangeEvent>()
let timer: ReturnType<typeof setTimeout> | null = null

export function dataChanged(event: ChangeEvent) {
  void getQueryClient().invalidateQueries()
  pending.add(event)
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, 400)
}

function flush() {
  timer = null
  if (!pending.size) return
  const events = [...pending]
  pending.clear()
  syncAfterChange(events).catch(() => {
    // offline or signed out: the next page load is fresh anyway
  })
}
