/**
 * Money for payments and receipts. Always integer paise; a rupee string from
 * an input is parsed exactly (no float maths), and formatting uses Indian
 * digit grouping. Pure, so the client, server and tests share it.
 */
import { amountInWords } from "../invoice/totals.ts"

/** Integer paise. Safe up to 9e15 (₹90 lakh crore). */
export type Paise = number

const MAX_PAISE = 9_000_000_000_000_000

/**
 * "24,575.50" → 2457550. Accepts digits with optional Indian or western
 * commas and up to two decimals. Returns null for anything else: negative,
 * exponent, more than two decimals, a second dot, blank.
 */
export function toPaise(rupees: string): Paise | null {
  const s = rupees.trim().replace(/^₹\s*/, "")
  // commas only between digits, at most one dot, at most two decimals
  if (!/^\d{1,3}(,?\d{2,3})*(\.\d{0,2})?$|^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(s)) return null
  const [whole, frac = ""] = s.replace(/,/g, "").split(".")
  const paise = Number(whole || "0") * 100 + Number(frac.padEnd(2, "0") || "0")
  return Number.isSafeInteger(paise) && paise <= MAX_PAISE ? paise : null
}

/** Paise → the text an input shows: 2457550 → "24575.50", 2457500 → "24575". */
export function paiseToInput(p: Paise) {
  const whole = Math.floor(p / 100)
  const frac = p % 100
  return frac ? `${whole}.${String(frac).padStart(2, "0")}` : String(whole)
}

const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

/**
 * "₹24,575.50", "₹1,24,575.00". `decimals: false` rounds to whole rupees
 * ("₹1,24,575") for headline numbers.
 */
export function formatINR(p: Paise, opts: { decimals?: boolean } = {}) {
  const sign = p < 0 ? "−" : ""
  const abs = Math.abs(p)
  return opts.decimals === false ? `${sign}₹${inr0.format(Math.round(abs / 100))}` : `${sign}₹${inr2.format(abs / 100)}`
}

/** "Rupees Twenty-Four Thousand Five Hundred Seventy-Five and Fifty Paise Only" */
export function amountInWordsINR(p: Paise) {
  return amountInWords(p)
}

/** Whole-percent share of an amount, rounded down to the paisa (50% of ₹14,575.01 → ₹7,287.50). */
export function percentOf(p: Paise, pct: number) {
  return Math.floor((p * pct) / 100)
}
