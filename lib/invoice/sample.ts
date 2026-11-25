import raw from "@/lib/landing/sample-invoice.json"

import { createInvoice } from "./defaults"
import type { Invoice } from "./types"

/**
 * The marketing sample (Rahul Design Studio → Lakeview Café, ₹27,140, paid)
 * as a full Invoice, for the login visual and any static previews.
 */
export function sampleInvoiceModel(): Invoice {
  const base = createInvoice({ id: "sample", today: "2025-11-14", counter: 14 })
  return {
    ...base,
    number: raw.number,
    issueDate: "2025-11-14",
    dueDate: "2025-11-28",
    status: "paid",
    clientId: "lakeview",
    billTo: {
      name: raw.billTo.name,
      address: { line1: raw.billTo.address[0], city: raw.billTo.city, pin: "560038", stateCode: raw.billTo.stateCode, country: "India" },
      email: raw.billTo.email,
    },
    placeOfSupply: raw.billTo.stateCode,
    items: raw.items.map((it, i) => ({ id: `s${i}`, name: it.name, hsnSac: it.sac, qty: it.qty, unit: "pcs", rate: it.rate * 100, taxRate: raw.tax.rate })),
    payment: { ...base.payment, upiId: raw.upi.id, paymentLink: true },
    notes: "",
  }
}
