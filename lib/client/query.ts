"use client"

import { QueryClient } from "@tanstack/react-query"

/**
 * The browser's data cache (TanStack Query) for what the browser fetches
 * itself, like the sidebar counts. Pages are Server Components; their cache
 * is Next's client cache (staleTimes in next.config) and both are cleared
 * together after every change (lib/client/sync).
 *
 * Money data is fresh for 60 s, never forever; tab focus refreshes it.
 */
function make() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnMount: false,
        retry: 1,
      },
    },
  })
}

let browserClient: QueryClient | undefined

/** One client per browser tab (a fresh one per server render). */
export function getQueryClient() {
  if (typeof window === "undefined") return make()
  return (browserClient ??= make())
}
