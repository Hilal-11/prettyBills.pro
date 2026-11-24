"use client"

import * as React from "react"

import { track, type AnalyticsEvent } from "@/lib/analytics"

/** One delegated listener for every `[data-event]` element on the page. */
export function AnalyticsListener() {
  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = (event.target as Element | null)?.closest<HTMLElement>("[data-event]")
      if (!target) return
      const { event: name, section, template } = target.dataset
      track(name as AnalyticsEvent, {
        section,
        template,
        label: target.textContent?.trim() || undefined,
        href: target.getAttribute("href") ?? undefined,
      })
    }
    document.addEventListener("click", onClick, { capture: true })
    return () => document.removeEventListener("click", onClick, { capture: true })
  }, [])
  return null
}
