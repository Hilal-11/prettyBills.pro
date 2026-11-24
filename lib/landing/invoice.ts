import raw from "./sample-invoice.json"

export type InvoiceItem = {
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
  from: { name: string; city: string; state: string; stateCode: string; gstin: string }
  billTo: { name: string; city: string; state: string; stateCode: string }
  placeOfSupply: string
  items: InvoiceItem[]
  tax: { type: "IGST" | "CGST+SGST"; rate: number }
  upi: { id: string; payeeName: string }
  status: "PAID" | "DUE"
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
