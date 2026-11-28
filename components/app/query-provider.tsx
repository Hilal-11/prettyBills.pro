"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { QueryClientProvider } from "@tanstack/react-query"

import { getQueryClient } from "@/lib/client/query"

/** How long a page may sit in the background before returning to the tab refreshes it. */
const FOCUS_REFRESH_MS = 60_000

/**
 * The browser data cache for the app, plus a quiet refresh of the current
 * page when the tab comes back after a minute away (a teammate's change, a
 * client paying), without skeletons: the old page stays until the new one is
 * ready.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  React.useEffect(() => {
    let hiddenAt = 0
    const onChange = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > FOCUS_REFRESH_MS) router.refresh()
    }
    document.addEventListener("visibilitychange", onChange)
    return () => document.removeEventListener("visibilitychange", onChange)
  }, [router])
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
}
