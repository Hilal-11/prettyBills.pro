"use server"

import { afterChange } from "@/lib/cache/invalidate"

import { buildCreditNote, fullRemaining, isCnReason, type CreditNoteInput } from "@/lib/billing/credit-notes"
import { isISODate, todayIST } from "@/lib/billing/dates"
import { billingMessage } from "@/lib/billing/errors"
import { isMode, type PaymentMode } from "@/lib/billing/modes"
import { applyClientCredit, clientCredits, createAndIssueCreditNote, creditContext, deleteCreditNoteDraft, deleteRefund, recordRefund, saveCreditNoteDraft, voidCreditNote } from "@/lib/server/db/credit-notes"
import { DbError, dbMessage } from "@/lib/server/db/util"
import { getSession, type ActionResult } from "@/lib/server/session"

/**
 * Credit note actions. Figures are always rebuilt here from the stored
 * invoice (lib/billing/credit-notes), never taken from the browser, and the
 * database checks every limit again in the same transaction it writes in.
 */

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>
const UUID = /^[0-9a-f-]{36}$/
const ID = /^[\w-]{1,96}$/

function fail(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof DbError && error.billing) return { ok: false, error: billingMessage(error.billing, error.detail), code: error.billing }
  if (error instanceof DbError) return { ok: false, error: dbMessage(error) }
  console.error("[credit-notes] unexpected error:", error instanceof Error ? error.message : error)
  return { ok: false, error: "Something went wrong. Nothing was saved. Try again." }
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

function validInput(input: CreditNoteInput): string | null {
  if (!input || !isISODate(input.cnDate)) return "Pick the credit note date."
  if (input.cnDate > todayIST()) return "The credit note date can't be in the future."
  if (!isCnReason(input.reason)) return "Pick a reason."
  if (input.reason === "other" && (input.reasonText?.trim().length ?? 0) < 3) return "Say what the credit is for."
  if (input.mode !== "items" && input.mode !== "lump_sum") return "Pick items or a lump sum."
  if ((input.notes?.length ?? 0) > 1000 || (input.reasonText?.length ?? 0) > 300) return "Notes are too long."
  return null
}

type RefundNow = { amount: number; refundedOn: string; mode: PaymentMode; reference?: string }

/**
 * Save a draft, or issue (save + issue in one transaction). After issuing,
 * an optional refund of the unapplied credit is recorded straight away.
 */
export async function saveCreditNoteAction(args: { id: string | null; invoiceId: string; input: CreditNoteInput; key: string; issue: boolean; refundNow?: RefundNow | null }): Promise<ActionResult<{ id: string; number: string | null; status: string; unapplied: number; refundError?: string }>> {
  const { id, invoiceId, input, key, issue } = args
  if ((id && !UUID.test(id)) || !ID.test(invoiceId) || !UUID.test(key)) return { ok: false, error: billingMessage("INVALID_INPUT") }
  const bad = validInput(input)
  if (bad) return { ok: false, error: bad }
  return withSession(async (s) => {
    const ctx = await creditContext(s.db, invoiceId)
    if (!ctx) return { ok: false as const, error: billingMessage("NOT_FOUND") }
    if (input.cnDate < ctx.summary.issueDate) return { ok: false as const, error: "The credit note can't be dated before the invoice." }
    const built = buildCreditNote(ctx.invoice, ctx.summary.total, ctx.prior, input)
    if (!built.ok) return { ok: false as const, error: built.error, code: built.code }
    const r = issue ? await createAndIssueCreditNote(s.db, id, invoiceId, built.doc, key) : await saveCreditNoteDraft(s.db, id, invoiceId, built.doc, key)
    let refundError: string | undefined
    const rn = args.refundNow
    if (issue && rn && r.creditNote.unapplied > 0) {
      const amount = Math.min(Math.round(rn.amount), r.creditNote.unapplied)
      if (amount > 0 && isISODate(rn.refundedOn) && isMode(rn.mode)) {
        try {
          await recordRefund(s.db, r.creditNote.id, { amount, refundedOn: rn.refundedOn, mode: rn.mode, reference: rn.reference?.slice(0, 64), key: crypto.randomUUID() })
        } catch (error) {
          refundError = fail(error).error
        }
      }
    }
    await afterChange("credit_note")
    return { ok: true as const, id: r.creditNote.id, number: r.creditNote.number, status: r.creditNote.status, unapplied: r.creditNote.unapplied, refundError }
  })
}

/** "Cancel invoice": a credit note for everything left on it, issued at once. */
export async function cancelInvoiceAction(invoiceId: string, reasonText: string, cnDate: string, key: string): Promise<ActionResult<{ id: string; number: string | null; unapplied: number }>> {
  if (!ID.test(invoiceId) || !UUID.test(key) || !isISODate(cnDate)) return { ok: false, error: billingMessage("INVALID_INPUT") }
  if (cnDate > todayIST()) return { ok: false, error: "The date can't be in the future." }
  return withSession(async (s) => {
    const ctx = await creditContext(s.db, invoiceId)
    if (!ctx) return { ok: false as const, error: billingMessage("NOT_FOUND") }
    const lines = fullRemaining(ctx.invoice, ctx.prior)
    if (!lines.length || ctx.summary.total - ctx.prior.total <= 0) return { ok: false as const, error: "This invoice is already fully credited." }
    const built = buildCreditNote(ctx.invoice, ctx.summary.total, ctx.prior, { cnDate, reason: "cancellation", reasonText: reasonText.trim().slice(0, 300) || undefined, mode: "items", lines })
    if (!built.ok) return { ok: false as const, error: built.error, code: built.code }
    const r = await createAndIssueCreditNote(s.db, null, invoiceId, built.doc, key)
    await afterChange("credit_note")
    return { ok: true as const, id: r.creditNote.id, number: r.creditNote.number, unapplied: r.creditNote.unapplied }
  })
}

export async function voidCreditNoteAction(id: string, reason: string): Promise<ActionResult> {
  if (!UUID.test(id)) return { ok: false, error: billingMessage("INVALID_INPUT") }
  if (reason.trim().length < 3) return { ok: false, error: billingMessage("INVALID_REASON") }
  return withSession(async (s) => {
    await voidCreditNote(s.db, id, reason.trim().slice(0, 200))
    await afterChange("credit_note")
    return { ok: true as const }
  })
}

export async function deleteCreditNoteDraftAction(id: string): Promise<ActionResult> {
  if (!UUID.test(id)) return { ok: false, error: billingMessage("INVALID_INPUT") }
  return withSession(async (s) => {
    await deleteCreditNoteDraft(s.db, id)
    await afterChange("credit_note")
    return { ok: true as const }
  })
}

export async function applyCreditAction(id: string, invoiceId: string, amount: number, key: string): Promise<ActionResult<{ unapplied: number }>> {
  if (!UUID.test(id) || !ID.test(invoiceId) || !UUID.test(key) || !Number.isInteger(amount) || amount <= 0) return { ok: false, error: billingMessage("INVALID_INPUT") }
  return withSession(async (s) => {
    const r = await applyClientCredit(s.db, id, invoiceId, amount, key)
    await afterChange("credit_note")
    return { ok: true as const, unapplied: r.creditNote.unapplied }
  })
}

export async function recordRefundAction(id: string, r: RefundNow & { note?: string; key: string }): Promise<ActionResult<{ unapplied: number }>> {
  if (!UUID.test(id) || !UUID.test(r.key) || !Number.isInteger(r.amount) || r.amount <= 0 || !isISODate(r.refundedOn) || !isMode(r.mode)) return { ok: false, error: billingMessage("INVALID_INPUT") }
  return withSession(async (s) => {
    const res = await recordRefund(s.db, id, { amount: r.amount, refundedOn: r.refundedOn, mode: r.mode, reference: r.reference?.slice(0, 64), note: r.note?.slice(0, 500), key: r.key })
    await afterChange("credit_note")
    return { ok: true as const, unapplied: res.creditNote.unapplied }
  })
}

export async function deleteRefundAction(refundId: string, reason: string): Promise<ActionResult> {
  if (!UUID.test(refundId) || reason.trim().length < 3) return { ok: false, error: billingMessage("INVALID_REASON") }
  return withSession(async (s) => {
    await deleteRefund(s.db, refundId, reason.trim().slice(0, 200))
    await afterChange("credit_note")
    return { ok: true as const }
  })
}

/**
 * Record payment's "Apply credit": the client's unapplied credit notes, oldest
 * first, applied to this invoice until it's settled or the credit runs out.
 */
export async function applyAvailableCreditAction(invoiceId: string): Promise<ActionResult<{ applied: number }>> {
  if (!ID.test(invoiceId)) return { ok: false, error: billingMessage("INVALID_INPUT") }
  return withSession(async (s) => {
    const { data: inv, error } = await s.db.from("invoices").select("client_id, balance_due").eq("id", invoiceId).maybeSingle()
    if (error) throw new DbError(error)
    if (!inv?.client_id) return { ok: false as const, error: "This invoice has no saved client, so there's no client credit to apply." }
    let balance = Number(inv.balance_due)
    let applied = 0
    for (const note of await clientCredits(s.db, inv.client_id as string)) {
      if (balance <= 0) break
      const amount = Math.min(note.unapplied, balance)
      if (amount <= 0) continue
      await applyClientCredit(s.db, note.id, invoiceId, amount, crypto.randomUUID())
      balance -= amount
      applied += amount
    }
    await afterChange("credit_note")
    return { ok: true as const, applied }
  })
}
