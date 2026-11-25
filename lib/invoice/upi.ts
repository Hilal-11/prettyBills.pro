import type { Invoice } from "./types"
import type { Totals } from "./totals"

/** NPCI UPI deep link for the invoice QR: pays the balance due. */
export function upiUri(invoice: Invoice, totals: Totals) {
  const params = new URLSearchParams({
    pa: invoice.payment.upiId ?? "",
    pn: invoice.from.name,
    am: (Math.max(0, totals.balanceDue) / 100).toFixed(2),
    cu: "INR",
    tn: invoice.number,
  })
  return `upi://pay?${params.toString()}`
}
