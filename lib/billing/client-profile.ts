/**
 * What a client's history says about them: since when, how they pay, and how
 * GST applies to them. Pure, so it's tested in billing.test.ts.
 */
import { daysBetween } from "./dates.ts"
import type { PaymentMode } from "./modes.ts"

export type ProfileInvoice = { status: string; issueDate: string; dueDate: string | null; paidOn: string | null }
export type ProfilePayment = { paidOn: string; mode: PaymentMode }

export type TaxTreatment = { label: string; detail: string }

/**
 * How tax works on invoices to this client: same state → CGST + SGST,
 * another state → IGST, outside India → export (zero-rated, LUT or IGST).
 */
export function taxTreatment(client: { gstin?: string; stateCode?: string; country?: string }, businessState: string | null | undefined): TaxTreatment | null {
  const country = client.country || "India"
  if (country !== "India") return { label: "Export", detail: "Zero-rated under LUT, or IGST paid" }
  const state = client.gstin?.slice(0, 2) || client.stateCode
  if (!state || !businessState) return null
  return state === businessState ? { label: "Intra-state", detail: "CGST + SGST" } : { label: "Inter-state", detail: "IGST" }
}

export function clientProfile(invoices: ProfileInvoice[], payments: ProfilePayment[]) {
  const billed = invoices.filter((i) => i.status !== "draft" && i.status !== "void")
  const dates = billed.map((i) => i.issueDate).sort()
  const paid = billed.filter((i) => i.status === "paid" && i.paidOn)
  const days = paid.map((i) => Math.max(0, daysBetween(i.issueDate, i.paidOn!)))
  const onTime = paid.filter((i) => !i.dueDate || i.paidOn! <= i.dueDate).length

  const modeCount = new Map<PaymentMode, number>()
  for (const p of payments) modeCount.set(p.mode, (modeCount.get(p.mode) ?? 0) + 1)
  const usual = [...modeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    firstInvoice: dates[0] ?? null,
    lastInvoice: dates.at(-1) ?? null,
    lastPayment: payments.map((p) => p.paidOn).sort().at(-1) ?? null,
    avgDaysToPay: days.length ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : null,
    onTimeRate: paid.length ? Math.round((onTime / paid.length) * 100) : null,
    paidInvoices: paid.length,
    usualMode: usual,
  }
}
