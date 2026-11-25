/** Where to land after signing in when nothing else is asked for. */
export const AFTER_AUTH = "/dashboard"

/**
 * Pages only signed-in users can open. The app itself is open to everyone:
 * guests make invoices in memory and see a "log in" state on pages that list
 * saved work; /invoices/<id> sends guests to log in by itself.
 */
export const PROTECTED = ["/reset-password"]

/** Pages a signed-in user has no reason to see. */
export const GUEST_ONLY = ["/login", "/signup", "/forgot-password"]

export const matches = (pathname: string, list: string[]) => list.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/**
 * Only same-site paths are allowed as a post-login destination, so a crafted
 * ?next=https://evil.example link can't bounce users off the site.
 */
export function safeNext(next: string | null | undefined, fallback = AFTER_AUTH) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  if (matches(next.split(/[?#]/)[0], GUEST_ONLY)) return fallback
  return next
}
