import { LIMITS } from "./config"
import type { Invoice } from "./types"

export const RX = {
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  pin: /^[1-9][0-9]{5}$/,
  upi: /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  url: /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i,
  phone: /^\+?[0-9][0-9\s-]{7,15}$/,
  hsn: /^[0-9]{4,8}$/,
}

export const SECTIONS = [
  { id: "business", label: "Business" },
  { id: "client", label: "Client" },
  { id: "details", label: "Details" },
  { id: "items", label: "Items" },
  { id: "tax", label: "Tax" },
  { id: "payment", label: "Payment" },
  { id: "notes", label: "Notes" },
  { id: "signature", label: "Signature" },
  { id: "more", label: "More" },
] as const

export type SectionId = (typeof SECTIONS)[number]["id"]

/** Field path → message. Paths look like "from.name" or "items.<id>.qty". */
export type FieldErrors = Record<string, string>

export interface Validation {
  errors: FieldErrors
  sections: Record<SectionId, { complete: boolean; issues: number }>
  firstInvalid?: { section: SectionId; field: string }
  requiredMissing: number
}

/** GSTIN characters 3–12 are the PAN. */
export function panFromGstin(gstin: string) {
  return RX.gstin.test(gstin) ? gstin.slice(2, 12) : ""
}

export function validateInvoice(inv: Invoice, ctx: { takenNumbers?: string[]; confirmAccount?: string } = {}): Validation {
  const errors: FieldErrors = {}
  const req = new Set<string>()
  const need = (path: string, ok: boolean, msg = "Required") => {
    if (!ok) {
      errors[path] = msg
      req.add(path)
    }
  }
  const fmt = (path: string, value: string | undefined, rx: RegExp, msg: string) => {
    if (value && !rx.test(value)) errors[path] = msg
  }

  // business
  const f = inv.from
  need("from.name", !!f.name.trim())
  need("from.address.line1", !!f.address.line1.trim())
  need("from.address.city", !!f.address.city.trim())
  need("from.address.stateCode", !!f.address.stateCode)
  fmt("from.gstin", f.gstin, RX.gstin, "Enter a valid 15-character GSTIN")
  fmt("from.pan", f.pan, RX.pan, "Enter a valid PAN, like ABCDE1234F")
  fmt("from.address.pin", f.address.pin, RX.pin, "PIN code is 6 digits")
  fmt("from.email", f.email, RX.email, "Enter a valid email")
  fmt("from.phone", f.phone, RX.phone, "Enter a valid phone number")
  fmt("from.website", f.website, RX.url, "Enter a valid website")
  if (f.name.length > 100) errors["from.name"] = "Keep it under 100 characters"

  // client
  need("billTo.name", !!inv.clientId && !!inv.billTo.name.trim(), "Choose a client")
  need("placeOfSupply", !!inv.placeOfSupply, "Choose the place of supply")
  fmt("billTo.gstin", inv.billTo.gstin, RX.gstin, "Client GSTIN looks invalid")
  if (inv.shipTo) {
    need("shipTo.name", !!inv.shipTo.name.trim())
    need("shipTo.line1", !!inv.shipTo.line1.trim())
    need("shipTo.city", !!inv.shipTo.city.trim())
  }

  // details
  need("number", !!inv.number.trim(), "Enter an invoice number")
  if (inv.number && ctx.takenNumbers?.includes(inv.number.trim())) errors.number = "This number is already used by another invoice"
  need("issueDate", !!inv.issueDate)
  need("dueDate", !!inv.dueDate)
  if (inv.issueDate && inv.dueDate && inv.dueDate < inv.issueDate) errors.dueDate = "Due date can't be before the issue date"
  if (inv.currency !== "INR" && !(inv.exchangeRate && inv.exchangeRate > 0)) errors.exchangeRate = "Enter the exchange rate to INR"

  // items
  if (inv.items.length === 0) need("items", false, "Add at least one item")
  for (const it of inv.items) {
    need(`items.${it.id}.name`, !!it.name.trim(), "Name the item")
    if (!(it.qty > 0)) need(`items.${it.id}.qty`, false, "Qty must be more than 0")
    if (!(it.rate >= 0)) need(`items.${it.id}.rate`, false, "Rate can't be negative")
    fmt(`items.${it.id}.hsnSac`, it.hsnSac, RX.hsn, "HSN/SAC is 4–8 digits")
  }

  // tax
  for (const c of inv.charges) need(`charges.${c.id}.label`, !!c.label.trim(), "Name the charge")
  if (inv.tcs && !(inv.tcs.rate > 0 && inv.tcs.rate <= 5)) errors["tcs.rate"] = "Enter a rate between 0 and 5%"

  // payment
  const p = inv.payment
  if (p.showUpiQr) {
    need("payment.upiId", !!p.upiId?.trim(), "Add a UPI ID or turn off the QR")
    fmt("payment.upiId", p.upiId, RX.upi, "Enter a valid UPI ID, like name@bank")
  }
  if (p.showBank) {
    need("payment.bank.holder", !!p.bank?.holder.trim())
    need("payment.bank.accountNumber", !!p.bank?.accountNumber.trim())
    if (p.bank?.accountNumber && !/^[0-9]{9,18}$/.test(p.bank.accountNumber)) errors["payment.bank.accountNumber"] = "Account numbers are 9–18 digits"
    if (ctx.confirmAccount !== undefined && p.bank?.accountNumber && ctx.confirmAccount !== p.bank.accountNumber)
      errors["payment.bank.confirm"] = "Account numbers don't match"
    need("payment.bank.ifsc", !!p.bank?.ifsc.trim())
    fmt("payment.bank.ifsc", p.bank?.ifsc, RX.ifsc, "IFSC looks like HDFC0001234")
  }

  // notes
  if ((inv.notes?.length ?? 0) > LIMITS.notesChars) errors.notes = `Keep notes under ${LIMITS.notesChars} characters`

  // signature
  if (inv.signature?.show) {
    const s = inv.signature
    const has = s.kind === "type" ? !!s.typedName?.trim() : !!s.imageUrl
    need("signature.source", has, s.kind === "type" ? "Type the signature" : s.kind === "draw" ? "Draw your signature" : "Upload a signature")
  }

  // more
  inv.customFields.forEach((c) => {
    if (c.value && !c.label.trim()) errors[`customFields.${c.id}.label`] = "Add a label"
  })
  const attachBytes = inv.attachments.reduce((s, a) => s + a.size, 0)
  if (attachBytes > LIMITS.attachmentsBytes) errors.attachments = "Attachments are limited to 10 MB in total"

  const sectionOf = (path: string): SectionId => {
    if (path.startsWith("from.")) return "business"
    if (path.startsWith("billTo.") || path.startsWith("shipTo.") || path === "placeOfSupply") return "client"
    if (["number", "issueDate", "dueDate", "exchangeRate"].includes(path)) return "details"
    if (path.startsWith("items")) return "items"
    if (path.startsWith("charges.") || path.startsWith("tcs.")) return "tax"
    if (path.startsWith("payment.")) return "payment"
    if (path === "notes") return "notes"
    if (path.startsWith("signature.")) return "signature"
    return "more"
  }

  const sections = Object.fromEntries(SECTIONS.map((s) => [s.id, { complete: true, issues: 0 }])) as Validation["sections"]
  let firstInvalid: Validation["firstInvalid"]
  for (const path of Object.keys(errors)) {
    const id = sectionOf(path)
    sections[id].complete = false
    sections[id].issues += 1
  }
  for (const s of SECTIONS) {
    const path = Object.keys(errors).find((p) => sectionOf(p) === s.id)
    if (path) {
      firstInvalid = { section: s.id, field: path }
      break
    }
  }

  return { errors, sections, firstInvalid, requiredMissing: [...req].filter((p) => errors[p]).length }
}
