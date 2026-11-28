"use client"

import * as React from "react"

/** Tells the server this public invoice (or quote, with `path`) was opened (first open → "Viewed"). */
export function ViewBeacon({ token, path }: { token: string; path?: string }) {
  React.useEffect(() => {
    const key = `pb-viewed-${token}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {}
    void fetch(path ?? `/api/public/${token}/view`, { method: "POST", keepalive: true }).catch(() => {})
  }, [token, path])
  return null
}
