"use server"

import { afterChange } from "@/lib/cache/invalidate"

import { billingMessage } from "@/lib/billing/errors"
import { checkConversion, conversionDocument, type ConversionLine, type RemainingLine } from "@/lib/billing/quotes"
import { uid } from "@/lib/invoice/format"
import { computeInvoiceTotals } from "@/lib/invoice/totals"
import type { Invoice, QuoteKind } from "@/lib/invoice/types"
import {
  conversionState,
  convertQuote,
  duplicateQuote,
  getQuoteSettings,
  reviseQuote,
  saveQuoteSettings,
  sendQuote,
  setQuoteStatus,
  voidQuote,
  type QuoteResult,
  type QuoteSettings,
} from "@/lib/server/db/quotes"
import { DbError, dbMessage, today } from "@/lib/server/db/util"
import { getSession, type ActionResult } from "@/lib/server/session"

/**
 * Quote and proforma actions. Each is one database function that checks the
 * status and logs it; conversions are rebuilt here from the stored quote
 * (never from the browser) and checked again in the database.
 */

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>
const ID = /^[\w-]{1,96}$/
const UUID = /^[0-9a-f-]{36}$/

function fail(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof DbError && error.billing) return { ok: false, error: billingMessage(error.billing, error.detail), code: error.billing }
  if (error instanceof DbError) return { ok: false, error: dbMessage(error) }
  console.error("[quotes] unexpected error:", error instanceof Error ? error.message : error)
  return { ok: false, error: "Something went wrong. Nothing was changed. Try again." }
}

async function run<T extends object>(fn: (s: Session) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getSession()
  if (!session) return { ok: false, error: "Your session has ended. Log in again." }
  try {
    const out = await fn(session)
    await afterChange("quote")
    return { ok: true, ...out }
  } catch (error) {
    return fail(error)
  }
}

const bad = (): { ok: false; error: string } => ({ ok: false, error: billingMessage("INVALID_INPUT") })

export async function reviseQuoteAction(id: string, confirm = false): Promise<ActionResult<{ quote: QuoteResult }>> {
  if (!ID.test(id)) return bad()
  return run(async (s) => ({ quote: await reviseQuote(s.db, id, confirm) }))
}

/** Sent outside PrettyBills (PDF, in person): mark it sent so Viewed / Expired and responses work. */
export async function markQuoteSentAction(id: string): Promise<ActionResult<{ quote: QuoteResult }>> {
  if (!ID.test(id)) return bad()
  return run(async (s) => ({ quote: await sendQuote(s.db, id, "manual") }))
}

/** A verbal or WhatsApp yes / no. Logged as "Marked accepted by <you>". */
export async function setQuoteStatusAction(id: string, status: "accepted" | "declined", note?: string): Promise<ActionResult<{ quote: QuoteResult }>> {
  if (!ID.test(id) || (status !== "accepted" && status !== "declined") || (note?.length ?? 0) > 1000) return bad()
  return run(async (s) => ({ quote: await setQuoteStatus(s.db, id, status, note?.trim() || undefined) }))
}

export async function voidQuoteAction(id: string, reason: string): Promise<ActionResult<{ quote: QuoteResult }>> {
  if (!ID.test(id)) return bad()
  const r = reason.trim()
  if (r.length < 3 || r.length > 200) return { ok: false, error: billingMessage("INVALID_REASON") }
  return run(async (s) => ({ quote: await voidQuote(s.db, id, r) }))
}

export async function duplicateQuoteAction(id: string, key: string): Promise<ActionResult<{ id: string; kind: QuoteKind }>> {
  if (!ID.test(id) || !UUID.test(key)) return bad()
  return run(async (s) => {
    const q = await duplicateQuote(s.db, id, uid("qt"), key)
    return { id: q.id, kind: q.kind }
  })
}

export type ConversionInfo = {
  number: string
  revision: number
  kind: QuoteKind
  status: string
  total: number
  convertedPaise: number
  expired: boolean
  allowMultiple: boolean
  remaining: RemainingLine[]
  /** The stored document, so the dialog previews the new total with the same maths. */
  document: Invoice
  id: string
}

/** What the conversion dialog needs: what's left per line and whether parts are allowed. */
export async function conversionInfoAction(id: string): Promise<ActionResult<{ info: ConversionInfo }>> {
  if (!ID.test(id)) return bad()
  const session = await getSession()
  if (!session) return { ok: false, error: "Your session has ended. Log in again." }
  try {
    const [state, settings] = await Promise.all([conversionState(session.db, id), getQuoteSettings(session.db)])
    if (!state) return { ok: false, error: billingMessage("NOT_FOUND") }
    const s = state.summary
    return {
      ok: true,
      info: {
        number: s.number,
        revision: s.revision,
        kind: s.kind,
        status: s.status,
        total: s.total,
        convertedPaise: s.convertedPaise,
        expired: s.display === "expired",
        allowMultiple: settings.allowMultiple,
        remaining: state.remaining,
        document: state.document,
        id: s.id,
      },
    }
  } catch (error) {
    return fail(error)
  }
}

/**
 * Converts to a draft invoice (or a quote to a proforma). `lines` only with
 * "multiple invoices per quote" on: those lines at those quantities.
 * Returns the new draft's id; the invoice gets its number when it's opened.
 */
export async function convertQuoteAction(args: { id: string; target: "invoice" | "proforma"; lines: ConversionLine[] | null; key: string }): Promise<ActionResult<{ targetType: "invoice" | "proforma"; targetId: string; total: number }>> {
  const { id, target, key } = args
  if (!ID.test(id) || !UUID.test(key) || (target !== "invoice" && target !== "proforma")) return bad()
  const session = await getSession()
  if (!session) return { ok: false, error: "Your session has ended. Log in again." }
  try {
    const [state, settings] = await Promise.all([conversionState(session.db, id), getQuoteSettings(session.db)])
    if (!state) return { ok: false, error: billingMessage("NOT_FOUND") }
    const s = state.summary
    // single mode, or nothing picked: everything that's left
    const lines = settings.allowMultiple && args.lines ? args.lines.map((l) => ({ id: String(l.id), qty: Math.round(Number(l.qty) * 1000) / 1000 })) : null
    const picked = lines ?? state.remaining.filter((r) => r.remaining > 0).map((r) => ({ id: r.id, qty: r.remaining }))
    const problem = checkConversion(picked, state.remaining)
    if (problem) return { ok: false, error: problem }
    // a partial conversion is a subset; a full one after earlier parts is what's left
    const partial = lines !== null || state.remaining.some((r) => r.converted > 0)
    const newId = uid(target === "invoice" ? "inv" : "pi")
    const doc = conversionDocument(state.document, { kind: s.kind, id: s.id, number: s.number }, target, { newId, today: today(), lines: partial ? picked : null })
    const res = await convertQuote(session.db, { id, target, lines: partial ? picked : null, doc, newId, key })
    await afterChange("quote")
    return { ok: true, targetType: res.targetType, targetId: res.targetId, total: computeInvoiceTotals(doc).total }
  } catch (error) {
    return fail(error)
  }
}

export async function saveQuoteSettingsAction(settings: QuoteSettings): Promise<ActionResult> {
  const days = Math.round(Number(settings.validityDays))
  if (!(days >= 1 && days <= 365) || (settings.title !== "Quotation" && settings.title !== "Estimate")) return bad()
  return run(async (s) => {
    await saveQuoteSettings(s.db, s.userId, { title: settings.title, validityDays: days, allowMultiple: !!settings.allowMultiple, autoConvert: !!settings.autoConvert, expiryReminders: !!settings.expiryReminders })
    return {}
  })
}
