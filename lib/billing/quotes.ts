/**
 * Quotes and proforma invoices: statuses, validity, conversion maths and the
 * wording that differs from invoices. Pure (no I/O), shared by server,
 * client and tests. The database (supabase/migrations/…_quotes_proformas)
 * enforces the same rules again when it writes.
 */
import { addDays } from "./dates.ts"
import type { Invoice, LineItem, QuoteKind, QuoteMeta, QuoteTitle } from "../invoice/types.ts"

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "converted" | "void"
/** What a list or badge shows: the stored status, plus Expired and Viewed for sent quotes. */
export type QuoteDisplay = "void" | "converted" | "accepted" | "declined" | "draft" | "expired" | "viewed" | "sent"

export const QUOTE_STATUSES: readonly QuoteStatus[] = ["draft", "sent", "accepted", "declined", "converted", "void"]
export const isQuoteStatus = (v: unknown): v is QuoteStatus => typeof v === "string" && (QUOTE_STATUSES as readonly string[]).includes(v)
export const isQuoteKind = (v: unknown): v is QuoteKind => v === "quote" || v === "proforma"

/** Precedence when more than one applies: Void → Converted → Accepted → Declined → Draft → Expired → Viewed → Sent. */
export const DISPLAY_ORDER: readonly QuoteDisplay[] = ["void", "converted", "accepted", "declined", "draft", "expired", "viewed", "sent"]

export const DISPLAY_LABEL: Record<QuoteDisplay, string> = {
  void: "Void",
  converted: "Converted",
  accepted: "Accepted",
  declined: "Declined",
  draft: "Draft",
  expired: "Expired",
  viewed: "Viewed",
  sent: "Sent",
}

/** Expired = sent and valid_until is before today (IST). Valid until today is still valid today. */
export function isExpired(q: { status: QuoteStatus; validUntil: string | null | undefined }, today: string) {
  return q.status === "sent" && !!q.validUntil && q.validUntil < today
}

export function displayStatus(q: { status: QuoteStatus; validUntil?: string | null; viewedAt?: string | null }, today: string): QuoteDisplay {
  if (q.status !== "sent") return q.status
  if (isExpired({ status: q.status, validUntil: q.validUntil }, today)) return "expired"
  return q.viewedAt ? "viewed" : "sent"
}

/** Days from today to valid_until (negative once expired), or null with no date. */
export function daysLeft(validUntil: string | null | undefined, today: string) {
  if (!validUntil) return null
  return Math.round((Date.parse(`${validUntil}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

/** Red once expired, amber within 3 days, otherwise plain. Only meaningful while waiting for an answer. */
export function validityTone(q: { status: QuoteStatus; validUntil?: string | null }, today: string): "danger" | "warning" | null {
  if (q.status !== "sent") return null
  const d = daysLeft(q.validUntil, today)
  if (d === null) return null
  if (d < 0) return "danger"
  if (d <= 3) return "warning"
  return null
}

/* -------------------------------- validity -------------------------------- */

export const VALIDITY_PRESETS = [7, 15, 30, 60] as const
export const DEFAULT_VALIDITY_DAYS = 15

export const validUntilFrom = (issueDate: string, days: number) => addDays(issueDate, days)

/** Which preset (if any) a date is, counted from the issue date. */
export function validityPreset(issueDate: string, validUntil: string | null | undefined): number | "custom" | null {
  if (!validUntil) return null
  const d = daysLeft(validUntil, issueDate)
  return d !== null && (VALIDITY_PRESETS as readonly number[]).includes(d) ? d : "custom"
}

/* --------------------------------- wording -------------------------------- */

export const KIND_LABEL: Record<QuoteKind, string> = { quote: "Quote", proforma: "Proforma invoice" }
export const KIND_PLURAL: Record<QuoteKind, string> = { quote: "Quotes", proforma: "Proforma invoices" }

/** Printed at the foot of the document. */
export function footnote(kind: QuoteKind) {
  return kind === "quote" ? "This is a quotation, not a tax invoice." : "This is a proforma invoice, not a tax invoice. A tax invoice will be issued on supply/payment."
}

/** QT/26-27/001, or QT/26-27/001 (Rev 2) from the second revision on. */
export function quoteLabel(number: string, revision = 1) {
  return revision > 1 ? `${number} (Rev ${revision})` : number
}

export function defaultMeta(kind: QuoteKind, opts: { title?: QuoteTitle; issueDate: string; validityDays?: number }): QuoteMeta {
  if (kind === "proforma") return { kind, title: "Proforma Invoice", validUntil: null }
  return { kind, title: opts.title === "Estimate" ? "Estimate" : "Quotation", validUntil: validUntilFrom(opts.issueDate, opts.validityDays ?? DEFAULT_VALIDITY_DAYS) }
}

/** The document's printed title ("Quotation", "Estimate", "Proforma Invoice", or the invoice's own). */
export const documentTitle = (inv: Pick<Invoice, "title" | "quote">) => inv.quote?.title ?? inv.title

/* ------------------------------- conversion ------------------------------- */

export type ConversionLine = { id: string; qty: number }
export type RemainingLine = { id: string; name: string; unit: string; qty: number; converted: number; remaining: number }

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Per line: quoted, converted so far (all conversions), and what's left. */
export function remainingLines(items: Pick<LineItem, "id" | "name" | "unit" | "qty">[], conversions: { lines: ConversionLine[] }[]): RemainingLine[] {
  const done = new Map<string, number>()
  for (const c of conversions) for (const l of c.lines) done.set(l.id, round3((done.get(l.id) ?? 0) + l.qty))
  return items.map((it) => {
    const converted = done.get(it.id) ?? 0
    return { id: it.id, name: it.name, unit: it.unit, qty: it.qty, converted, remaining: Math.max(0, round3(it.qty - converted)) }
  })
}

/** Problems with a picked set of lines, or null when it's fine (the database checks again). */
export function checkConversion(picked: ConversionLine[], remaining: RemainingLine[]): string | null {
  if (!picked.length) return "Pick at least one item to invoice."
  const left = new Map(remaining.map((r) => [r.id, r]))
  const seen = new Set<string>()
  for (const p of picked) {
    const r = left.get(p.id)
    if (!r || seen.has(p.id)) return "One of the items isn't on this quote."
    seen.add(p.id)
    if (!(p.qty > 0)) return `Enter a quantity above 0 for ${r.name}.`
    if (round3(p.qty) > r.remaining) return `Only ${r.remaining} ${r.unit} of ${r.name} is left to invoice.`
  }
  return null
}

/** Days after the issue date the invoice is due, from its payment terms. */
export function termDays(doc: Pick<Invoice, "paymentTerms" | "issueDate" | "dueDate">) {
  const fixed: Record<string, number> = { due_on_receipt: 0, net_7: 7, net_15: 15, net_30: 30, net_45: 45, net_60: 60 }
  if (doc.paymentTerms in fixed) return fixed[doc.paymentTerms]
  const gap = doc.dueDate && doc.issueDate ? Math.round((Date.parse(`${doc.dueDate}T00:00:00Z`) - Date.parse(`${doc.issueDate}T00:00:00Z`)) / 86_400_000) : NaN
  return Number.isFinite(gap) && gap >= 0 ? gap : 15
}

/**
 * The new draft made from a quote or proforma: client, items, notes, terms,
 * template, page colour, language, signature, custom fields and discounts all
 * copied. Dated today; the invoice is due by its payment terms and gets its
 * number from the invoice series when it's first saved. With `lines`, only
 * those lines at those quantities (milestone billing).
 * Mirrors private.quote_to_document in the database.
 */
export function conversionDocument(
  quote: Invoice,
  source: { kind: QuoteKind; id: string; number: string },
  target: "invoice" | "proforma",
  opts: { newId: string; today: string; lines?: ConversionLine[] | null }
): Invoice {
  const qty = opts.lines ? new Map(opts.lines.map((l) => [l.id, l.qty])) : null
  const items = quote.items.filter((it) => (qty ? qty.has(it.id) : true)).map((it) => (qty ? { ...it, qty: qty.get(it.id)! } : { ...it }))
  const base: Invoice = {
    ...quote,
    id: opts.newId,
    status: "draft",
    revision: 1,
    linkActive: true,
    publicToken: undefined,
    sentAt: undefined,
    issueDate: opts.today,
    items,
    source: { type: source.kind, id: source.id, number: source.number },
    createdAt: opts.today,
    updatedAt: opts.today,
  }
  if (target === "proforma") return { ...base, quote: { kind: "proforma", title: "Proforma Invoice", validUntil: null } }
  const { quote: _meta, ...rest } = base
  void _meta
  return {
    ...rest,
    number: "",
    dueDate: addDays(opts.today, termDays(quote)),
    title: quote.from.gstin ? "Tax Invoice" : "Bill of Supply",
    payment: { ...quote.payment, amountPaid: 0 },
  }
}

/* ---------------------------------- share --------------------------------- */

export function quoteWhatsappText(args: { kind: QuoteKind; clientName: string; number: string; amount: string; validUntil: string | null; link: string }) {
  const what = args.kind === "quote" ? "quotation" : "proforma invoice"
  const until = args.validUntil ? `, valid until ${args.validUntil}` : ""
  return `Hi ${args.clientName}, here's our ${what} ${args.number} for ${args.amount}${until}: ${args.link}`
}

export function quoteEmailSubject(kind: QuoteKind, number: string, business: string, amount: string, title?: QuoteTitle) {
  const word = kind === "proforma" ? "Proforma invoice" : title === "Estimate" ? "Estimate" : "Quotation"
  return `${word} ${number} from ${business} – ${amount}`
}
