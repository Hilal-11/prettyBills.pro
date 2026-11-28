import raw from "./sample-invoice.json"

export type InvoiceItem = {
  id?: string
  name: string
  sac: string
  qty: number
  rate: number
}

export type SampleInvoice = {
  number: string
  issueDate: string
  dueDate: string
  currency: "INR"
  from: { name: string; city: string; state: string; stateCode: string; gstin: string; address?: string[]; email?: string }
  billTo: { name: string; city: string; state: string; stateCode: string; address?: string[]; email?: string }
  placeOfSupply: string
  items: InvoiceItem[]
  tax: { type: "IGST" | "CGST+SGST"; rate: number }
  upi: { id: string; payeeName: string }
  status: "PAID" | "DUE"
  /** What the rendered invoice shows. All default to on. */
  display?: { showQr?: boolean; payNow?: boolean }
  notes?: string
  /** Invoice asks for payment; receipt confirms it. Defaults to invoice. */
  kind?: "invoice" | "receipt"
  receipt?: { number: string; method: string; paidDate: string }
  /** Quotes and proformas: the printed title, the date line and the foot note. */
  doc?: { title: string; dueLabel: string; due: string; footnote: string }
}

export const sampleInvoice = raw as SampleInvoice

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

/** ₹15,000 style formatting (Indian digit grouping). */
export function formatINR(amount: number) {
  return `₹${inr.format(amount)}`
}

export function invoiceTotals(invoice: SampleInvoice) {
  const lines = invoice.items.map((item) => ({ ...item, amount: item.qty * item.rate }))
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
  const tax = Math.round((subtotal * invoice.tax.rate) / 100)
  return { lines, subtotal, tax, total: subtotal + tax }
}

/** Tax rows as printed: one IGST row, or CGST + SGST at half the rate each. */
export function taxLines(invoice: SampleInvoice, tax: number) {
  const { type, rate } = invoice.tax
  if (type === "IGST") return [{ label: `IGST ${rate}%`, amount: tax }]
  const half = rate / 2
  const cgst = Math.round(tax / 2)
  return [
    { label: `CGST ${half}%`, amount: cgst },
    { label: `SGST ${half}%`, amount: tax - cgst },
  ]
}

/** UPI deep link encoded in the invoice QR (NPCI `upi://pay` format). */
export function upiLink(invoice: SampleInvoice) {
  const { total } = invoiceTotals(invoice)
  const params = new URLSearchParams({
    pa: invoice.upi.id,
    pn: invoice.upi.payeeName,
    am: total.toFixed(2),
    cu: "INR",
    tn: invoice.number,
  })
  return `upi://pay?${params.toString()}`
}
