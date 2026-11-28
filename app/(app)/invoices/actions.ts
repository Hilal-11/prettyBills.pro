"use server"

import { afterChange } from "@/lib/cache/invalidate"

import { nextInvoiceNumber, uid } from "@/lib/invoice/format"
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice/totals"
import { formatDate } from "@/lib/invoice/format"
import { addEvent, deleteDraft, duplicateInvoice, ensureShareLink, getInvoice, listNumbers, markSentManually, voidInvoice } from "@/lib/server/db/invoices"
import { dbMessage, today } from "@/lib/server/db/util"
import { getSession, type ActionResult } from "@/lib/server/session"
import { headers } from "next/headers"

/**
 * Actions from invoice lists. Each one checks the session itself (Server
 * Actions are public endpoints) and RLS keeps it to the caller's invoices.
 */

const ID = /^[\w-]{1,96}$/

async function run<T extends object>(id: string, fn: (s: NonNullable<Awaited<ReturnType<typeof getSession>>>) => Promise<T | null>): Promise<ActionResult<T>> {
  if (!ID.test(id)) return { ok: false, error: "Invalid invoice" }
  const session = await getSession()
  if (!session) return { ok: false, error: "Your session has ended. Log in again." }
  try {
    const result = await fn(session)
    if (!result) return { ok: false, error: "That invoice doesn't exist any more." }
    await afterChange("invoice")
    return { ok: true, ...result }
  } catch (error) {
    return { ok: false, error: error instanceof Error && !("status" in error) ? error.message : dbMessage(error) }
  }
}

/** Void is only for invoices never sent; a sent one is cancelled with a credit note (GST). */
export async function voidAction(id: string) {
  return run(id, async ({ db, userId }) => {
    const { data } = await db.from("invoices").select("sent_at").eq("id", id).maybeSingle()
    if (data?.sent_at) throw new Error("This invoice was sent, so it can't be voided. Use Cancel invoice: it issues a credit note, as GST requires.")
    return (await voidInvoice(db, userId, id)) ? {} : null
  })
}

export async function deleteDraftAction(id: string) {
  return run(id, async ({ db }) => ((await deleteDraft(db, id)) ? {} : null))
}

/** Copies an invoice into a new draft with the next number. Returns the new id. */
export async function duplicateAction(id: string) {
  return run(id, async ({ db, userId }) => {
    const numbers = await listNumbers(db)
    const copy = await duplicateInvoice(db, userId, id, uid("inv"), nextInvoiceNumber(numbers.map((n) => n.number), today()))
    return copy ? { id: copy.id } : null
  })
}

/**
 * Everything needed to chase a payment: the share link (made if needed) and
 * a ready WhatsApp message. Records a "reminded" event.
 */
export async function reminderAction(id: string) {
  return run(id, async ({ db, userId }) => {
    const invoice = await getInvoice(db, id)
    if (!invoice) return null
    const link = await ensureShareLink(db, id, true)
    if (!link) return null
    const h = await headers()
    const origin = (process.env.PRETTYBILL_PUBLIC_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.PRETTYBILL_ORIGIN ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`).replace(/\/+$/, "")
    const url = `${origin}/i/${link.token}`
    const totals = computeInvoiceTotals(invoice)
    const due = invoice.dueDate ? formatDate(invoice.dueDate, invoice.dateFormat) : null
    const text = `Hi ${invoice.billTo.name || "there"}, a reminder about invoice ${invoice.number} for ${formatMoney(totals.balanceDue, { whole: true })}${due ? `, due ${due}` : ""}. You can view and pay it here: ${url}`
    const digits = (invoice.billTo.phone ?? "").replace(/\D/g, "")
    const phone = digits.length === 10 ? `91${digits}` : digits
    await addEvent(db, userId, id, "reminded")
    return { url, text, whatsapp: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` }
  })
}

/** The invoice's public link, made on first use. */
export async function shareLinkAction(id: string) {
  return run(id, async ({ db }) => {
    const link = await ensureShareLink(db, id, true)
    if (!link) return null
    const h = await headers()
    const origin = (process.env.PRETTYBILL_PUBLIC_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.PRETTYBILL_ORIGIN ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`).replace(/\/+$/, "")
    return { url: `${origin}/i/${link.token}` }
  })
}

/**
 * Bulk actions from the invoices table, up to 100 at a time.
 * "send" marks finished drafts as sent (anything else is skipped);
 * "delete" deletes drafts only: sent invoices are kept for GST records.
 */
export async function bulkInvoicesAction(kind: "send" | "delete", ids: string[]): Promise<ActionResult<{ done: number; skipped: number }>> {
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every((id) => typeof id === "string" && ID.test(id))) return { ok: false, error: "Choose between 1 and 100 invoices." }
  const session = await getSession()
  if (!session) return { ok: false, error: "Your session has ended. Log in again." }
  try {
    let done = 0
    if (kind === "delete") {
      const { data, error } = await session.db.from("invoices").delete().in("id", ids).eq("status", "draft").select("id")
      if (error) throw error
      done = data.length
    } else {
      for (const id of ids) {
        const r = await markSentManually(session.db, session.userId, id).catch(() => null)
        if (r && r.status !== "draft") done++
      }
    }
    await afterChange("invoice")
    return { ok: true, done, skipped: ids.length - done }
  } catch (error) {
    return { ok: false, error: dbMessage(error) }
  }
}
