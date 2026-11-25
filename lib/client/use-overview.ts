"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { EMPTY_OVERVIEW, type Overview } from "@/lib/data/types"

import { onInvoicesChanged } from "./workspace"

/**
 * Invoice counts for the sidebar. Refetched when the page changes, when an
 * invoice is saved, sent or paid anywhere on the page, and when the tab
 * comes back into focus. Guests get zeros.
 */
export function useOverview() {
  const pathname = usePathname()
  const [overview, setOverview] = React.useState<Overview>(EMPTY_OVERVIEW)
  const [nonce, setNonce] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    fetch("/api/invoices/overview", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { overview?: Overview } | null) => d?.overview && setOverview(d.overview))
      .catch(() => {})
    return () => controller.abort()
  }, [pathname, nonce])

  React.useEffect(() => {
    const bump = () => setNonce((n) => n + 1)
    const onFocus = () => document.visibilityState === "visible" && bump()
    const off = onInvoicesChanged(bump)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      off()
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [])

  return overview
}
