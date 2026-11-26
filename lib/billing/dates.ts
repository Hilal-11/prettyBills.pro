/**
 * Business dates. PrettyBills is for India: "today", "overdue" and the
 * financial year all follow Asia/Kolkata, whatever the server or browser
 * clock says. Dates are ISO yyyy-mm-dd strings; never `toISOString().slice(0, 10)`,
 * which is the UTC date and wrong between 00:00 and 05:30 IST.
 */

export const IST = "Asia/Kolkata"

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" })
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** The current time in ms. Server pages render once per request, so "now" is that request's time. */
export function nowMs() {
  return Date.now()
}

/** Today's date in India. */
export function todayIST(at: Date = new Date()) {
  return ymd.format(at)
}

/** The India calendar date of a timestamp. */
export function dateIST(iso: string) {
  return ymd.format(new Date(iso))
}

function parts(iso: string) {
  const m = ISO.exec(iso)
  if (!m) throw new RangeError(`Not an ISO date: ${iso}`)
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

export function isISODate(s: string) {
  if (!ISO.test(s)) return false
  const { y, m, d } = parts(s)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Financial year (April–March): 2026-11-25 → "26-27", 2027-03-31 → "26-27", 2027-04-01 → "27-28". */
export function fyLabel(iso: string) {
  const { y, m } = parts(iso)
  const start = m >= 4 ? y : y - 1
  return `${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`
}

/** First and last day of the financial year containing `iso`. */
export function fyRange(iso: string) {
  const { y, m } = parts(iso)
  const start = m >= 4 ? y : y - 1
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` }
}

/** "25 Nov 2026" */
export function formatDate(iso: string | null | undefined) {
  if (!iso || !ISO.test(iso.slice(0, 10))) return "—"
  const { y, m, d } = parts(iso.slice(0, 10))
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`
}

/** Whole days from a to b. Positive when b is later. */
export function daysBetween(a: string, b: string) {
  const pa = parts(a)
  const pb = parts(b)
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000)
}

export function addDays(iso: string, n: number) {
  const { y, m, d } = parts(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10) // UTC midnight in, UTC date out: safe here
}

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

function monthEnd(iso: string) {
  const { y, m } = parts(iso)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export const DATE_PRESETS = ["today", "this_week", "this_month", "last_30", "last_month", "this_fy", "last_fy", "all", "custom"] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

export const PRESET_LABEL: Record<DatePreset, string> = {
  today: "Today",
  this_week: "This week",
  this_month: "This month",
  last_30: "Last 30 days",
  last_month: "Last month",
  this_fy: "This FY",
  last_fy: "Last FY",
  all: "All time",
  custom: "Custom",
}

/** The dates a preset covers, as of `today`. Weeks start on Monday. `all` has no bounds. */
export function presetRange(preset: DatePreset, today: string): { from: string | null; to: string | null } {
  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "this_week": {
      const { y, m, d } = parts(today)
      const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
      return { from: addDays(today, -dow), to: today }
    }
    case "this_month":
      return { from: monthStart(today), to: today }
    case "last_30":
      return { from: addDays(today, -29), to: today }
    case "last_month": {
      const prev = addDays(monthStart(today), -1)
      return { from: monthStart(prev), to: monthEnd(prev) }
    }
    case "this_fy":
      return { from: fyRange(today).from, to: today }
    case "last_fy": {
      const prev = addDays(fyRange(today).from, -1)
      return fyRange(prev)
    }
    case "all":
    case "custom":
      return { from: null, to: null }
  }
}
