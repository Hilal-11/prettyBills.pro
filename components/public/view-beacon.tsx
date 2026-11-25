"use client"

import * as React from "react"

/** Tells the server this public invoice was opened (first open → "Viewed"). */
export function ViewBeacon({ token }: { token: string }) {
  React.useEffect(() => {
    const key = `pb-viewed-${token}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {}
    void fetch(`/api/public/${token}/view`, { method: "POST", keepalive: true }).catch(() => {})
  }, [token])
  return null
}
