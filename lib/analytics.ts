/**
 * Landing page analytics. Every CTA carries `data-event` + `data-section`, and
 * <AnalyticsListener /> turns clicks into `track()` calls, so server-rendered
 * buttons need no client JS of their own.
 *
 * `track()` pushes to `window.dataLayer` (GTM / GA4 / PostHog snippets all read
 * it) and fires a `prettybill:track` DOM event for anything else listening.
 */
export type AnalyticsEvent =
  | "cta_create_click"
  | "cta_templates_click"
  | "template_use_click"
  | "template_preview_open"
  | "dev_docs_click"
  | "waitlist_submit"
  | "login_click"
  | "support_click"

export type AnalyticsProps = Record<string, string | undefined>

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}) {
  if (typeof window === "undefined") return
  const payload = { event, ...props }
  ;(window.dataLayer ??= []).push(payload)
  window.dispatchEvent(new CustomEvent("prettybill:track", { detail: payload }))
  if (process.env.NODE_ENV !== "production") console.debug("[track]", payload)
}

/** Spread onto any CTA: `<Link {...trackAttrs("cta_create_click", "hero")} />`. */
export function trackAttrs(event: AnalyticsEvent, section: string, extra?: Record<string, string>) {
  const attrs: Record<string, string> = { "data-event": event, "data-section": section }
  for (const [key, value] of Object.entries(extra ?? {})) attrs[`data-${key}`] = value
  return attrs
}
