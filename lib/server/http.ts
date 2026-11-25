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

export const json = (data: unknown, status = 200) => Response.json(data, { status })
