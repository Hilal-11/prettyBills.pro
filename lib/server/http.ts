import type { Invoice } from "@/lib/invoice/types"

/** Light shape check for invoices posted by the editor. */
export function parseInvoice(body: unknown): Invoice | null {
  const inv = (body as { invoice?: Invoice } | null)?.invoice
  if (!inv || typeof inv !== "object") return null
  if (typeof inv.id !== "string" || !/^[\w-]{1,96}$/.test(inv.id)) return null
  if (!Array.isArray(inv.items) || !inv.from || !inv.billTo || !inv.payment) return null
  if (JSON.stringify(inv).length > 15_000_000) return null
  return inv
}

export function originOf(request: Request) {
  return process.env.PRETTYBILL_ORIGIN ?? new URL(request.url).origin
}

/**
 * The address clients should open (links in emails, WhatsApp reminders). Set
 * PRETTYBILL_PUBLIC_URL to your live domain; locally it's the dev server.
 */
export function publicOrigin(request: Request) {
  const configured = process.env.PRETTYBILL_PUBLIC_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  return configured ? configured.replace(/\/+$/, "") : originOf(request)
}

export const json = (data: unknown, status = 200) => Response.json(data, { status })

/** For Server Actions (no Request): the app's own origin and the one clients should open. */
export async function actionOrigins() {
  const { headers } = await import("next/headers")
  const h = await headers()
  const own = (process.env.PRETTYBILL_ORIGIN ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`).replace(/\/+$/, "")
  const configured = process.env.PRETTYBILL_PUBLIC_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  return { origin: own, publicOrigin: configured ? configured.replace(/\/+$/, "") : own }
}
