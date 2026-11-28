"use server"

import { afterChange } from "@/lib/cache/invalidate"

import { todayIST } from "@/lib/billing/dates"
import { billingMessage } from "@/lib/billing/errors"
import { paymentDelete, paymentInput, paymentUpdate } from "@/lib/billing/validation"
import type { InvoiceSummary, PaymentResult, PlanSummary } from "@/lib/data/types"
import { computeInvoiceTotals } from "@/lib/invoice/totals"
import { clientCredits } from "@/lib/server/db/credit-notes"
import { planSummary } from "@/lib/server/billing"
import { getInvoice, listInvoices, markSentManually } from "@/lib/server/db/invoices"
import { deletePayment, getReceiptView, lastClientTds, lastPaymentMode, noteReceiptEvent, recordPayment, setTdsCertificate, updatePayment } from "@/lib/server/db/payments"
import { DbError, dbMessage } from "@/lib/server/db/util"
import { actionOrigins } from "@/lib/server/http"
import { receiptLink, receiptShare, sendReceiptEmail, type ReceiptEmailOutcome } from "@/lib/server/receipts"
import { getSession, type ActionResult } from "@/lib/server/session"

/**
 * Payment actions. Server Actions are public endpoints, so each checks the
 * session itself and validates its input; the database functions then check
 * ownership and the money rules again inside one transaction.
 *
 * Emails go out only after the payment is saved, and an email failure is
 * reported next to a successful payment rather than undoing it.
 */

/**
 * What the payment dialog needs about an invoice. `amountPaid` is what's
 * settled so far (received + TDS) and `tdsPaid` the TDS part of it;
 * `taxable` is the value excluding GST, the base the TDS helper works on.
 */
export type PaymentContext = { id: string; number: string; clientName: string; clientEmail: string | null; issueDate: string; total: number; taxable: number; amountPaid: number; tdsPaid: number; balanceDue: number; status: string }

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

export type PaymentActionResult = ActionResult<{ result: PaymentResult; email?: ReceiptEmailOutcome }>

function fail(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof DbError && error.billing) return { ok: false, error: billingMessage(error.billing, error.detail), code: error.billing }
  if (error instanceof DbError) return { ok: false, error: dbMessage(error) }
  console.error("[payments] unexpected error:", error instanceof Error ? error.message : error)
  return { ok: false, error: billingMessage("UNKNOWN") }
}

async function withSession<T>(fn: (s: Session) => Promise<T>): Promise<T | { ok: false; error: string; code?: string }> {
  const session = await getSession()
  if (!session) return { ok: false, error: "Your session has ended. Log in again." }
  try {
    return await fn(session)
  } catch (error) {
    return fail(error)
  }
}

async function emailAfter(s: Session, receiptId: string, triggeredBy: "manual" | "auto") {
  const origins = await actionOrigins()
  return sendReceiptEmail(s.db, s.userId, receiptId, { triggeredBy, ...origins }).catch((error: unknown): ReceiptEmailOutcome => {
    console.error("[payments] receipt email crashed:", error instanceof Error ? error.message : error)
    return { status: "failed", message: "The receipt email couldn't be sent." }
  })
}

export async function recordPaymentAction(input: unknown, opts: { emailReceipt?: boolean } = {}): Promise<PaymentActionResult> {
  const parsed = paymentInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? billingMessage("INVALID_INPUT") }
  return withSession(async (s) => {
    const result = await recordPayment(s.db, parsed.data)
    await afterChange("payment")
    const email = opts.emailReceipt && !result.replayed ? await emailAfter(s, result.receipt.id, "auto") : undefined
    return { ok: true as const, result, email }
  })
}

export async function updatePaymentAction(input: unknown, opts: { emailReceipt?: boolean } = {}): Promise<PaymentActionResult> {
  const parsed = paymentUpdate.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? billingMessage("INVALID_INPUT") }
  return withSession(async (s) => {
    const result = await updatePayment(s.db, parsed.data)
    await afterChange("payment")
    const email = opts.emailReceipt ? await emailAfter(s, result.receipt.id, "manual") : undefined
    return { ok: true as const, result, email }
  })
}

export async function deletePaymentAction(input: unknown): Promise<PaymentActionResult> {
  const parsed = paymentDelete.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? billingMessage("INVALID_REASON") }
  return withSession(async (s) => {
    const result = await deletePayment(s.db, parsed.data.paymentId, parsed.data.reason)
    await afterChange("payment")
    return { ok: true as const, result }
  })
}

/** "Mark as paid": the full balance, today, by the mode used last. */
export async function payInFullAction(invoiceId: string, idempotencyKey: string): Promise<PaymentActionResult> {
  return withSession(async (s) => {
    const inv = await s.db.from("invoices").select("balance_due").eq("id", invoiceId).maybeSingle()
    if (inv.error) throw new DbError(inv.error)
    if (!inv.data) return { ok: false as const, error: billingMessage("NOT_FOUND") }
    const balance = Number(inv.data.balance_due)
    if (balance <= 0) return { ok: false as const, error: "This invoice is already paid in full." }
    const parsed = paymentInput.safeParse({ invoiceId, amountPaise: balance, paidOn: todayIST(), mode: (await lastPaymentMode(s.db)) ?? "upi", idempotencyKey })
    if (!parsed.success) return { ok: false as const, error: billingMessage("INVALID_INPUT") }
    const result = await recordPayment(s.db, parsed.data)
    await afterChange("payment")
    return { ok: true as const, result }
  })
}

/** A finished draft that went out some other way (PDF, link, WhatsApp) becomes "sent". */
export async function markSentAction(invoiceId: string): Promise<ActionResult<{ status: string }>> {
  if (!/^[\w-]{1,96}$/.test(invoiceId)) return { ok: false, error: "Invalid invoice" }
  const session = await getSession()
  if (!session) return { ok: false, error: "Your session has ended. Log in again." }
  try {
    const r = await markSentManually(session.db, session.userId, invoiceId)
    if (!r) return { ok: false, error: "That invoice doesn't exist any more." }
    await afterChange("payment")
    return { ok: true, status: r.status }
  } catch (error) {
    return { ok: false, error: error instanceof Error && !(error instanceof DbError) ? error.message : dbMessage(error) }
  }
}

export async function emailReceiptAction(receiptId: string): Promise<ActionResult<{ email: ReceiptEmailOutcome }>> {
  if (!/^[0-9a-f-]{36}$/.test(receiptId)) return { ok: false, error: "Invalid receipt" }
  return withSession(async (s) => {
    const email = await emailAfter(s, receiptId, "manual")
    await afterChange("payment")
    return { ok: true as const, email }
  })
}

/** The receipt's public link and a ready WhatsApp message. */
export async function receiptShareAction(receiptId: string): Promise<ActionResult<{ url: string; whatsapp: string; text: string }>> {
  if (!/^[0-9a-f-]{36}$/.test(receiptId)) return { ok: false, error: "Invalid receipt" }
  return withSession(async (s) => {
    const view = await getReceiptView(s.db, receiptId)
    if (!view || !view.receipt.publicToken) return { ok: false as const, error: billingMessage("NOT_FOUND") }
    if (view.receipt.status === "void") return { ok: false as const, error: "This receipt is void, so its link is off." }
    const { publicOrigin } = await actionOrigins()
    const url = receiptLink(publicOrigin, view.receipt.publicToken)
    await noteReceiptEvent(s.db, receiptId, "receipt.shared")
    return { ok: true as const, url, ...receiptShare(view, url) }
  })
}

/** What the record-payment dialog needs about an invoice, fresh from the server. */
export async function paymentContextAction(invoiceId: string): Promise<
  ActionResult<{ invoice: PaymentContext; lastMode: string | null; plan: PlanSummary; clientTds: { section: string; rateBp: number | null } | null; clientCredit: number }>
> {
  if (!/^[\w-]{1,96}$/.test(invoiceId)) return { ok: false, error: "Invalid invoice" }
  return withSession(async (s) => {
    const [inv, row, lastMode, plan] = await Promise.all([
      getInvoice(s.db, invoiceId),
      s.db.from("invoices").select("total, amount_paid, tds_paise, balance_due, status, client_id").eq("id", invoiceId).maybeSingle(),
      lastPaymentMode(s.db),
      planSummary(s.db, s.userId),
    ])
    if (row.error) throw new DbError(row.error)
    if (!inv || !row.data) return { ok: false as const, error: billingMessage("NOT_FOUND") }
    const total = Number(row.data.total)
    const totals = computeInvoiceTotals(inv)
    // value excluding GST, scaled to the stored total so rounding can't push it past the invoice
    const taxable = totals.total > 0 ? Math.min(total, Math.round((total * (totals.total - totals.taxTotal)) / totals.total)) : total
    const clientId = (row.data.client_id as string | null) ?? null
    const [clientTds, credits] = await Promise.all([lastClientTds(s.db, clientId), clientId ? clientCredits(s.db, clientId).catch(() => []) : Promise.resolve([])])
    return {
      ok: true as const,
      invoice: {
        id: inv.id,
        number: inv.number,
        clientName: inv.billTo.name,
        clientEmail: inv.billTo.email ?? null,
        issueDate: inv.issueDate,
        total,
        taxable,
        amountPaid: Number(row.data.amount_paid),
        tdsPaid: Number(row.data.tds_paise ?? 0),
        balanceDue: Number(row.data.balance_due),
        status: row.data.status as string,
      },
      lastMode,
      plan,
      clientTds,
      // unapplied credit notes of this client (Record payment offers to apply them)
      clientCredit: credits.reduce((sum, n) => sum + n.unapplied, 0),
    }
  })
}

/** Invoices that can take a payment (sent, with a balance), for the picker on the Payments and Client pages. */
export async function openInvoicesAction(clientId?: string): Promise<ActionResult<{ invoices: Pick<InvoiceSummary, "id" | "number" | "clientName" | "balanceDue" | "dueDate" | "bucket">[] }>> {
  return withSession(async (s) => {
    const [sent, overdue] = await Promise.all([listInvoices(s.db, { bucket: "sent", clientId, limit: 100 }), listInvoices(s.db, { bucket: "overdue", clientId, limit: 100 })])
    const invoices = [...overdue.invoices, ...sent.invoices]
      .filter((i) => i.balanceDue > 0)
      .map((i) => ({ id: i.id, number: i.number, clientName: i.clientName, balanceDue: i.balanceDue, dueDate: i.dueDate, bucket: i.bucket }))
    return { ok: true as const, invoices }
  })
}

/** Form 16A / TDS certificate received for these payments (the TDS tab's toggle). */
export async function setTdsCertificateAction(paymentIds: string[], received: boolean): Promise<ActionResult<{ changed: number }>> {
  if (!Array.isArray(paymentIds) || !paymentIds.length || paymentIds.length > 500 || !paymentIds.every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id)) || typeof received !== "boolean")
    return { ok: false, error: billingMessage("INVALID_INPUT") }
  return withSession(async (s) => {
    const changed = await setTdsCertificate(s.db, paymentIds, received)
    await afterChange("payment")
    return { ok: true as const, changed }
  })
}
