/**
 * The single source of truth for invoice maths. Pure, no runtime imports, so it
 * runs identically in the editor, the PDF renderer, the API and the tests.
 *
 * Rules (all amounts in integer paise):
 * 1. Line base = qty × rate − line discount, rounded half-up per line.
 * 2. Invoice discount is spread across lines in proportion to their base
 *    (largest-remainder, so the parts add up exactly).
 * 3. Tax per line = taxable × rate. Intra-state: half CGST, half SGST.
 *    Inter-state: IGST. Exempt / nil / export: 0.
 * 4. Additional charges are taxed at their own rate.
 * 5. Total = Σ taxable + Σ tax + charges (+ TCS).
 * 6. Round off to the nearest rupee (100 paise); the difference is a line.
 * 7. Balance due = total − amount paid.
 */
import type { Discount, Invoice, Paise } from "./types"

export type TaxMode = "intra" | "inter" | "export"

export interface LineTotals {
  id: string
  gross: Paise // qty × rate
  lineDiscount: Paise
  base: Paise // gross − line discount (the line "Amount")
  invoiceDiscountShare: Paise
  taxable: Paise
  rate: number
  tax: Paise
}

export interface TaxRow {
  kind: "IGST" | "CGST" | "SGST"
  rate: number // the printed rate (CGST/SGST rows show half)
  taxable: Paise
  amount: Paise
}

export interface Totals {
  mode: TaxMode
  lines: LineTotals[]
  subtotal: Paise // Σ line base
  invoiceDiscount: Paise
  charges: { id: string; label: string; amount: Paise; rate: number; tax: Paise }[]
  chargesTotal: Paise
  taxableTotal: Paise // after invoice discount, excluding charges
  taxRows: TaxRow[]
  taxTotal: Paise
  tcs: Paise
  beforeRound: Paise
  roundOff: Paise
  total: Paise
  amountPaid: Paise
  balanceDue: Paise
  /** Show "Total excluding tax" only when it differs from the subtotal. */
  showTotalExclTax: boolean
}

/** Round half away from zero, to an integer. */
export function roundHalfUp(n: number) {
  return Math.sign(n) * Math.round(Math.abs(n) + Number.EPSILON * Math.abs(n))
}

function discountAmount(base: Paise, d: Discount | undefined): Paise {
  if (!d || !d.value) return 0
  const raw = d.kind === "percent" ? roundHalfUp((base * d.value) / 100) : roundHalfUp(d.value)
  return Math.min(Math.max(raw, 0), Math.max(base, 0))
}

/** Split `total` across `weights` in proportion, exactly (largest remainder). */
export function allocate(total: Paise, weights: Paise[]): Paise[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (!total || sum <= 0) return weights.map(() => 0)
  const exact = weights.map((w) => (total * w) / sum)
  const parts = exact.map(Math.floor)
  let rest = total - parts.reduce((a, b) => a + b, 0)
  const order = exact.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0])
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) parts[order[k][1]] += 1
  return parts
}

export function taxMode(invoice: Pick<Invoice, "supplyType" | "placeOfSupply" | "from">): TaxMode {
  if (invoice.supplyType === "export") return "export"
  return invoice.from.address.stateCode === invoice.placeOfSupply ? "intra" : "inter"
}

export function computeInvoiceTotals(invoice: Invoice): Totals {
  const mode = taxMode(invoice)

  // 1. line bases
  const pre = invoice.items.map((item) => {
    const gross = roundHalfUp(item.qty * item.rate)
    const lineDiscount = discountAmount(gross, item.discount)
    return { item, gross, lineDiscount, base: gross - lineDiscount }
  })
  const subtotal = pre.reduce((s, l) => s + l.base, 0)

  // 2. invoice discount, spread by base
  const invoiceDiscount = discountAmount(subtotal, invoice.invoiceDiscount)
  const shares = allocate(invoiceDiscount, pre.map((l) => l.base))

  // 3. tax per line
  const taxBuckets = new Map<number, { taxable: Paise; tax: Paise }>()
  const addTax = (rate: number, taxable: Paise, tax: Paise) => {
    const b = taxBuckets.get(rate) ?? { taxable: 0, tax: 0 }
    b.taxable += taxable
    b.tax += tax
    taxBuckets.set(rate, b)
  }

  const lines: LineTotals[] = pre.map((l, i) => {
    const taxable = l.base - shares[i]
    const exempt = l.item.taxCategory === "exempt" || l.item.taxCategory === "nil" || mode === "export"
    const rate = exempt ? 0 : l.item.taxRate
    const tax = roundHalfUp((taxable * rate) / 100)
    if (rate > 0) addTax(rate, taxable, tax)
    return { id: l.item.id, gross: l.gross, lineDiscount: l.lineDiscount, base: l.base, invoiceDiscountShare: shares[i], taxable, rate, tax }
  })

  // 4. charges, taxed at their own rate
  const charges = invoice.charges.map((c) => {
    const rate = mode === "export" ? 0 : c.taxRate
    const tax = roundHalfUp((c.amount * rate) / 100)
    if (rate > 0) addTax(rate, c.amount, tax)
    return { id: c.id, label: c.label, amount: c.amount, rate, tax }
  })
  const chargesTotal = charges.reduce((s, c) => s + c.amount, 0)

  // tax rows, per rate
  const taxRows: TaxRow[] = []
  for (const [rate, b] of [...taxBuckets.entries()].sort((a, b) => a[0] - b[0])) {
    if (mode === "intra") {
      const cgst = roundHalfUp(b.tax / 2)
      taxRows.push({ kind: "CGST", rate: rate / 2, taxable: b.taxable, amount: cgst })
      taxRows.push({ kind: "SGST", rate: rate / 2, taxable: b.taxable, amount: b.tax - cgst })
    } else {
      taxRows.push({ kind: "IGST", rate, taxable: b.taxable, amount: b.tax })
    }
  }
  const taxTotal = taxRows.reduce((s, r) => s + r.amount, 0)

  // 5. total (+ TCS on the tax-inclusive value)
  const taxableTotal = lines.reduce((s, l) => s + l.taxable, 0)
  const preTcs = taxableTotal + taxTotal + chargesTotal
  const tcs = invoice.tcs?.rate ? roundHalfUp((preTcs * invoice.tcs.rate) / 100) : 0
  const beforeRound = preTcs + tcs

  // 6. round off to the nearest rupee
  const total = invoice.roundOff ? roundHalfUp(beforeRound / 100) * 100 : beforeRound
  const roundOff = total - beforeRound

  // 7. balance
  const amountPaid = Math.max(0, invoice.payment.amountPaid || 0)

  return {
    mode,
    lines,
    subtotal,
    invoiceDiscount,
    charges,
    chargesTotal,
    taxableTotal,
    taxRows,
    taxTotal,
    tcs,
    beforeRound,
    roundOff,
    total,
    amountPaid,
    balanceDue: total - amountPaid,
    showTotalExclTax: invoiceDiscount > 0 || chargesTotal > 0,
  }
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

/**
 * Indian-style money: ₹1,23,456.78.
 * `whole` drops paise when the amount is a whole rupee (headline amounts).
 */
export function formatMoney(paise: Paise, opts: { whole?: boolean; sign?: boolean; symbol?: string } = {}) {
  const symbol = opts.symbol ?? "₹"
  const abs = Math.abs(paise) / 100
  const body = opts.whole && Number.isInteger(abs) ? inr0.format(abs) : inr2.format(abs)
  const sign = paise < 0 ? "−" : opts.sign && paise > 0 ? "+" : ""
  return `${sign}${symbol}${body}`
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function twoDigits(n: number) {
  if (n < 20) return ones[n]
  const t = tens[Math.floor(n / 10)]
  return n % 10 ? `${t}-${ones[n % 10]}` : t
}

function threeDigits(n: number) {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ones[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ")
}

/** Indian numbering system words: crore, lakh, thousand, hundred. */
export function numberToIndianWords(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return "Zero"
  const parts: string[] = []
  const crore = Math.floor(n / 1_00_00_000)
  n %= 1_00_00_000
  const lakh = Math.floor(n / 1_00_000)
  n %= 1_00_000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (n) parts.push(threeDigits(n))
  return parts.join(" ")
}

/** "Rupees Five Thousand Eight Hundred Ninety-Nine Only" (with paise when present). */
export function amountInWords(paise: Paise) {
  const rupees = Math.floor(Math.abs(paise) / 100)
  const p = Math.abs(paise) % 100
  const words = `Rupees ${numberToIndianWords(rupees)}`
  return p ? `${words} and ${twoDigits(p)} Paise Only` : `${words} Only`
}
