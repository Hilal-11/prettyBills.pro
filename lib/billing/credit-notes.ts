/**
 * Credit notes: what can be credited on an invoice, and the figures for one.
 * Tax is worked out by the invoice engine itself (computeInvoiceTotals), on
 * a stand-in invoice whose lines are the credited amounts, so tax, the
 * CGST/SGST split and round-off match the original exactly. The database
 * checks the same limits again when the note is saved and issued.
 * Pure: tested in billing.test.ts.
 */
import { computeInvoiceTotals, roundHalfUp } from "../invoice/totals.ts"
import type { Invoice, Paise } from "../invoice/types.ts"

export const CN_REASONS = [
  { key: "sales_return", label: "Sales return (goods returned)" },
  { key: "post_sale_discount", label: "Post-sale discount" },
  { key: "service_deficiency", label: "Deficiency in services" },
  { key: "invoice_correction", label: "Correction in invoice (excess amount or rate)" },
  { key: "tax_correction", label: "Change in place of supply / tax correction" },
  { key: "cancellation", label: "Cancellation of invoice (full)" },
  { key: "other", label: "Other" },
] as const
export type CnReason = (typeof CN_REASONS)[number]["key"]
export const isCnReason = (v: unknown): v is CnReason => CN_REASONS.some((r) => r.key === v)
export const reasonLabel = (key: string) => CN_REASONS.find((r) => r.key === key)?.label ?? key

/** What earlier issued credit notes on the invoice already took: per line (taxable) and in total. */
export type PriorCredit = { lines: Record<string, Paise>; total: Paise }

export type CreditLineInput = { lineId: string; kind: "qty" | "amount"; qty?: number; amount?: Paise }
export type CreditNoteInput = {
  cnDate: string
  reason: CnReason
  reasonText?: string
  notes?: string
  mode: "items" | "lump_sum"
  lines?: CreditLineInput[]
  lump?: { description: string; taxable: Paise; rate: number }
}

/** One line of the invoice as a credit note sees it (charges included, ids prefixed "charge:"). */
export type CreditableLine = { id: string; name: string; hsnSac?: string; qty: number; unit: string; rate: number; taxable: Paise; remaining: Paise; charge: boolean; taxCategory?: string }

export type CnDocItem = {
  invoice_item_id: string | null
  name: string
  description?: string | null
  hsn_sac?: string | null
  qty: number
  unit?: string | null
  rate_paise: Paise
  discount_paise: Paise
  taxable_paise: Paise
  tax_rate_bp: number
  tax_paise: Paise
  total_paise: Paise
  orig_taxable_paise: Paise | null
}

/** Exactly what save_credit_note_draft / create_and_issue_credit_note take. */
export type CnDoc = {
  cn_date: string
  reason: CnReason
  reason_text: string | null
  notes: string | null
  mode: "items" | "lump_sum"
  tax_type: "igst" | "cgst_sgst" | "none"
  taxable_paise: Paise
  cgst_paise: Paise
  sgst_paise: Paise
  igst_paise: Paise
  round_off_paise: Paise
  total_paise: Paise
  items: CnDocItem[]
}

export type CnBuild = { ok: true; doc: CnDoc; maxCreditable: Paise } | { ok: false; error: string; code: "LINE_CREDIT_EXCEEDED" | "CREDIT_EXCEEDS_INVOICE" | "INVALID"; lineId?: string; maxCreditable: Paise }

/** Every line (and charge) of the invoice with what's still creditable on it. */
export function creditableLines(invoice: Invoice, prior: PriorCredit): CreditableLine[] {
  const totals = computeInvoiceTotals(invoice)
  const lines = invoice.items.map((item, i) => {
    const t = totals.lines[i]
    return { id: item.id, name: item.name, hsnSac: item.hsnSac, qty: item.qty, unit: item.unit, rate: item.taxCategory && item.taxCategory !== "taxable" ? 0 : item.taxRate, taxable: t.taxable, remaining: Math.max(0, t.taxable - (prior.lines[item.id] ?? 0)), charge: false, taxCategory: item.taxCategory }
  })
  const charges = (invoice.charges ?? []).map((c) => {
    const id = `charge:${c.id}`
    return { id, name: c.label, qty: 1, unit: "", rate: c.taxRate, taxable: c.amount, remaining: Math.max(0, c.amount - (prior.lines[id] ?? 0)), charge: true }
  })
  return [...lines, ...charges].filter((l) => l.taxable > 0)
}

/** The tax rates used on the invoice (the lump-sum rate must be one of them). */
export function invoiceRates(invoice: Invoice) {
  return [...new Set(creditableLines(invoice, { lines: {}, total: 0 }).map((l) => l.rate))].sort((a, b) => a - b)
}

/** GST: credit for a note dated after 30 Nov following the end of the invoice's FY may not be claimable. */
export function gstDeadline(invoiceDate: string) {
  const y = Number(invoiceDate.slice(0, 4))
  const m = Number(invoiceDate.slice(5, 7))
  return `${m >= 4 ? y + 1 : y}-11-30`
}
export const isLateForGst = (invoiceDate: string, cnDate: string) => cnDate > gstDeadline(invoiceDate)

const taxType = (rows: { kind: string }[]): CnDoc["tax_type"] => (rows.some((r) => r.kind === "IGST") ? "igst" : rows.some((r) => r.kind === "CGST") ? "cgst_sgst" : "none")

/**
 * The credit note's figures. `invoiceTotal` is the stored invoice total (the
 * cap is total − what earlier notes credited). A cancellation is made to land
 * exactly on what's left, any difference going to round-off.
 */
export function buildCreditNote(invoice: Invoice, invoiceTotal: Paise, prior: PriorCredit, input: CreditNoteInput): CnBuild {
  const maxCreditable = Math.max(0, invoiceTotal - prior.total)
  const available = creditableLines(invoice, prior)
  const fail = (error: string, code: "LINE_CREDIT_EXCEEDED" | "CREDIT_EXCEEDS_INVOICE" | "INVALID", lineId?: string): CnBuild => ({ ok: false, error, code, lineId, maxCreditable })

  type Picked = { src?: CreditableLine; name: string; hsnSac?: string; qty: number; unit: string; taxable: Paise; rate: number; taxCategory?: string }
  const picked: Picked[] = []

  if (input.mode === "lump_sum") {
    const l = input.lump
    if (!l || !l.description.trim()) return fail("Describe the adjustment.", "INVALID")
    if (!(l.taxable > 0)) return fail("Enter a taxable amount above ₹0.", "INVALID")
    if (!invoiceRates(invoice).includes(l.rate)) return fail("Pick a tax rate used on the invoice.", "INVALID")
    picked.push({ name: l.description.trim().slice(0, 300), qty: 1, unit: "", taxable: Math.round(l.taxable), rate: l.rate })
  } else {
    for (const want of input.lines ?? []) {
      const src = available.find((l) => l.id === want.lineId)
      if (!src) return fail("A line on this credit note isn't on the invoice any more.", "INVALID", want.lineId)
      let taxable: number
      let qty: number
      if (want.kind === "qty") {
        qty = Math.round((want.qty ?? 0) * 1000) / 1000
        if (!(qty > 0) || qty > src.qty) return fail(`Credit between 0 and ${src.qty} of “${src.name}”.`, "INVALID", src.id)
        taxable = qty === src.qty ? src.taxable : roundHalfUp((src.taxable * qty) / src.qty)
      } else {
        taxable = Math.round(want.amount ?? 0)
        qty = 1
        if (!(taxable > 0)) return fail(`Enter an amount for “${src.name}”.`, "INVALID", src.id)
      }
      if (taxable > src.remaining) return fail(`“${src.name}” has only ${(src.remaining / 100).toFixed(2)} left to credit.`, "LINE_CREDIT_EXCEEDED", src.id)
      picked.push({ src, name: want.kind === "amount" && !src.charge ? `${src.name} (price adjustment)` : src.name, hsnSac: src.hsnSac, qty, unit: src.unit, taxable, rate: src.rate, taxCategory: src.taxCategory })
    }
    if (!picked.length) return fail("Pick at least one line to credit.", "INVALID")
  }

  // the invoice engine, on a stand-in invoice of just the credited amounts
  const standIn: Invoice = {
    ...invoice,
    items: picked.map((p, i) => ({ id: `cn${i}`, name: p.name, qty: 1, unit: p.unit, rate: p.taxable, taxRate: p.rate, taxCategory: p.taxCategory as Invoice["items"][number]["taxCategory"] })),
    invoiceDiscount: undefined,
    charges: [],
    tcs: undefined,
  }
  const t = computeInvoiceTotals(standIn)
  let roundOff = t.roundOff
  let total = t.total
  if (input.reason === "cancellation") {
    // a full cancellation credits exactly what's left on the invoice
    roundOff += maxCreditable - total
    total = maxCreditable
  }
  if (total <= 0) return fail("The credit note total must be above ₹0.", "INVALID")
  if (total > maxCreditable) return fail(`This invoice can be credited ${(maxCreditable / 100).toFixed(2)} at most.`, "CREDIT_EXCEEDS_INVOICE")

  const sum = (kind: string) => t.taxRows.filter((r) => r.kind === kind).reduce((s, r) => s + r.amount, 0)
  const doc: CnDoc = {
    cn_date: input.cnDate,
    reason: input.reason,
    reason_text: input.reasonText?.trim() || null,
    notes: input.notes?.trim() || null,
    mode: input.mode,
    tax_type: taxType(t.taxRows),
    taxable_paise: t.lines.reduce((s, l) => s + l.taxable, 0),
    cgst_paise: sum("CGST"),
    sgst_paise: sum("SGST"),
    igst_paise: sum("IGST"),
    round_off_paise: roundOff,
    total_paise: total,
    items: picked.map((p, i) => ({
      invoice_item_id: p.src?.id ?? null,
      name: p.name,
      hsn_sac: p.hsnSac ?? null,
      qty: p.qty,
      unit: p.unit || null,
      rate_paise: Math.round(t.lines[i].taxable / p.qty),
      discount_paise: 0,
      taxable_paise: t.lines[i].taxable,
      tax_rate_bp: Math.round(p.rate * 100),
      tax_paise: t.lines[i].tax,
      total_paise: t.lines[i].taxable + t.lines[i].tax,
      orig_taxable_paise: p.src ? p.src.taxable : null,
    })),
  }
  return { ok: true, doc, maxCreditable }
}

/** Every remaining line in full: "Credit full remaining amount", and the base of a cancellation. */
export function fullRemaining(invoice: Invoice, prior: PriorCredit): CreditLineInput[] {
  return creditableLines(invoice, prior)
    .filter((l) => l.remaining > 0)
    .map((l) => (l.remaining === l.taxable ? { lineId: l.id, kind: "qty" as const, qty: l.qty } : { lineId: l.id, kind: "amount" as const, amount: l.remaining }))
}
