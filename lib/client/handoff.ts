import type { CatalogItem, Client } from "@/lib/invoice/defaults"
import type { Invoice } from "@/lib/invoice/types"

/**
 * Guests' work lives only in memory. The one exception: when a guest chooses
 * to log in or sign up, the invoice they're working on is parked here briefly
 * so it comes with them into their account (or back into the editor if they
 * change their mind and return). It's read, then deleted, on the next editor load.
 *
 * Deliberately not in KEYS, so switching accounts never wipes a pending handoff.
 */
const KEY = "pb.guestHandoff"
const TTL = 60 * 60_000

export type GuestWork = { invoice: Invoice; clients: Client[]; catalog: CatalogItem[] }

let provider: (() => (GuestWork & { edited: boolean }) | null) | null = null

/** The guest editor registers what it would hand over. Returns an unregister function. */
export function registerGuestWork(fn: NonNullable<typeof provider>) {
  provider = fn
  return () => {
    if (provider === fn) provider = null
  }
}

/**
 * Parks the guest's invoice (only if they changed something) so the next
 * /create load picks it up. Returns whether anything was parked.
 */
export function parkGuestWork() {
  const work = provider?.()
  if (!work?.edited) return false
  try {
    const data = { invoice: work.invoice, clients: work.clients, catalog: work.catalog, expires: Date.now() + TTL }
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/**
 * Parks the guest's work and returns the auth page URL. With work parked,
 * they come back to /create, where it's saved into their account; otherwise to `next`.
 */
export function authHref(mode: "login" | "signup", next = "/dashboard") {
  const target = parkGuestWork() ? "/create" : next
  return `/${mode}?next=${encodeURIComponent(target)}`
}

/** Reads the parked work, if any and still fresh. Call clearGuestWork() once it's been used. */
export function peekGuestWork(): GuestWork | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as GuestWork & { expires: number }
    if (!data.invoice?.id || data.expires < Date.now()) {
      localStorage.removeItem(KEY)
      return null
    }
    return { invoice: data.invoice, clients: data.clients ?? [], catalog: data.catalog ?? [] }
  } catch {
    return null
  }
}

export function clearGuestWork() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
