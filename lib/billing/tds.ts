/**
 * TDS (tax deducted at source) on a payment. The client deducts a rate on
 * the invoice's taxable value (excluding GST), pro-rated to the part of the
 * invoice this payment settles, rounded to the nearest rupee. The result is
 * only a suggestion: the amount the client actually deducted always wins.
 */
import { TDS_SECTIONS, type TdsSection } from "../../config/tds.ts"

export { TDS_SECTIONS, type TdsSection }

export const tdsSection = (key: string | null | undefined): TdsSection | undefined => TDS_SECTIONS.find((s) => s.key === key)

/** "Professional services", or the stored key for a section no longer in the config. */
export const tdsLabel = (key: string | null | undefined) => (key ? (tdsSection(key)?.label ?? key) : "")

/** "10%", "0.1%" */
export const rateLabel = (bp: number) => `${(bp / 100).toFixed(2).replace(/\.?0+$/, "")}%`

const roundRupee = (paise: number) => Math.round(paise / 100) * 100

/**
 * TDS on settling `settle` paise of an invoice with this `total` and
 * `taxable` value (both paise): rate × taxable × settle / total.
 */
export function tdsOnSettlement({ total, taxable, settle, rateBp }: { total: number; taxable: number; settle: number; rateBp: number }) {
  if (total <= 0 || settle <= 0 || rateBp <= 0) return 0
  const base = (Math.min(taxable, total) * Math.min(settle, total)) / total
  return roundRupee((base * rateBp) / 10_000)
}

/**
 * The split when the client deducts TDS and pays the rest. With `settle`
 * (e.g. the full balance), TDS comes off it; with only the amount that
 * reached the bank, TDS is grossed up so TDS = rate × taxable share of
 * (received + TDS).
 */
export function splitWithTds(opts: { total: number; taxable: number; rateBp: number } & ({ settle: number } | { received: number })) {
  const { total, taxable, rateBp } = opts
  if ("settle" in opts) {
    const tds = tdsOnSettlement({ total, taxable, settle: opts.settle, rateBp })
    return { received: opts.settle - tds, tds }
  }
  const k = total > 0 ? (Math.min(taxable, total) / total) * (rateBp / 10_000) : 0
  const tds = k > 0 && k < 1 ? roundRupee((opts.received * k) / (1 - k)) : 0
  return { received: opts.received, tds }
}

/** The taxable base this payment's TDS is worked out on, for the helper text. */
export const tdsBase = (total: number, taxable: number, settle: number) => (total > 0 ? Math.round((Math.min(taxable, total) * Math.min(settle, total)) / total) : 0)

/* ------------------------------- TDS report ------------------------------- */

export const QUARTERS = [
  { q: 1, label: "Q1", months: "Apr–Jun" },
  { q: 2, label: "Q2", months: "Jul–Sep" },
  { q: 3, label: "Q3", months: "Oct–Dec" },
  { q: 4, label: "Q4", months: "Jan–Mar" },
] as const

/** Indian FY quarter of a date: Apr–Jun is Q1, Jan–Mar Q4. */
export const fyQuarter = (iso: string) => {
  const m = Number(iso.slice(5, 7))
  return m >= 4 ? Math.floor((m - 4) / 3) + 1 : 4
}

export type TdsReportPayment = { id: string; invoiceId: string; clientId: string | null; clientName: string; clientPan: string | null; paidOn: string; tdsPaise: number; tdsSection: string | null; tdsCertificate: boolean }

export type TdsClientRow = {
  key: string
  clientId: string | null
  clientName: string
  clientPan: string | null
  sections: string[]
  invoices: number
  tds: number
  paymentIds: string[]
  /** Certificates (Form 16A) received: for all of these payments, some, or none. */
  certificate: "all" | "some" | "none"
}

/**
 * TDS grouped by FY quarter, then by client: what each client deducted,
 * under which sections, on how many invoices, and whether the certificates
 * have come in. For matching against Form 26AS / AIS.
 */
export function tdsReport(payments: TdsReportPayment[]) {
  const quarters = QUARTERS.map((q) => ({ ...q, total: 0, rows: new Map<string, TdsClientRow & { _inv: Set<string>; _got: number }>() }))
  for (const p of payments) {
    if (p.tdsPaise <= 0) continue
    const quarter = quarters[fyQuarter(p.paidOn) - 1]
    const key = p.clientId ?? `name:${p.clientName.trim().toLowerCase()}`
    const row = quarter.rows.get(key) ?? { key, clientId: p.clientId, clientName: p.clientName || "No client", clientPan: p.clientPan, sections: [], invoices: 0, tds: 0, paymentIds: [], certificate: "none" as const, _inv: new Set<string>(), _got: 0 }
    row.tds += p.tdsPaise
    row.paymentIds.push(p.id)
    row._inv.add(p.invoiceId)
    if (p.tdsSection && !row.sections.includes(p.tdsSection)) row.sections.push(p.tdsSection)
    if (p.tdsCertificate) row._got++
    row.clientPan ??= p.clientPan
    quarter.rows.set(key, row)
    quarter.total += p.tdsPaise
  }
  return quarters.map(({ rows, ...q }) => ({
    ...q,
    rows: [...rows.values()]
      .map(({ _inv, _got, ...r }) => ({ ...r, invoices: _inv.size, certificate: (_got === 0 ? "none" : _got === r.paymentIds.length ? "all" : "some") as TdsClientRow["certificate"] }))
      .sort((a, b) => b.tds - a.tds || a.clientName.localeCompare(b.clientName)),
  }))
}
