/**
 * The invoices table keeps everything in the URL (tab, search, clients,
 * issue dates, amount range, sort, how many pages are loaded), so a view
 * survives a reload, can be bookmarked, and the CSV export sees exactly what
 * the table shows. The page, the export route and the toolbar share this.
 */
import { addDays, DATE_PRESETS, isISODate, presetRange, type DatePreset } from "./dates.ts"

type Params = Record<string, string | string[] | undefined> | URLSearchParams

/** Tabs. `upcoming` is open invoices due in the next 30 days; `void` only shows when there are some. */
export const INVOICE_VIEWS = ["all", "draft", "sent", "overdue", "paid", "upcoming", "void"] as const
export type InvoiceView = (typeof INVOICE_VIEWS)[number]

export const INVOICE_SORTS = ["number", "client", "amount", "balance", "issued", "due", "paid", "updated"] as const
export type InvoiceSort = (typeof INVOICE_SORTS)[number]
export type SortDir = "asc" | "desc"

export type InvoiceQuery = {
  view: InvoiceView
  q: string
  clients: string[]
  /** Issue date range; "all" has no bounds. */
  preset: DatePreset
  from: string | null
  to: string | null
  /** Invoice total bounds, in paise. */
  min: number | null
  max: number | null
  sort: InvoiceSort
  dir: SortDir
  page: number
}

export const UPCOMING_DAYS = 30
export const MAX_PAGES = 10

/** What each tab is sorted by until someone clicks a column. */
export function defaultSort(view: InvoiceView): { sort: InvoiceSort; dir: SortDir } {
  switch (view) {
    case "draft":
      return { sort: "updated", dir: "desc" }
    case "sent":
    case "overdue":
    case "upcoming":
      return { sort: "due", dir: "asc" }
    case "paid":
      return { sort: "paid", dir: "desc" }
    case "void":
      return { sort: "updated", dir: "desc" }
    default:
      return { sort: "issued", dir: "desc" }
  }
}

function get(p: Params, key: string) {
  const v = p instanceof URLSearchParams ? p.get(key) : p[key]
  return (Array.isArray(v) ? v[0] : v) ?? ""
}

/** "1,50,000.50" or "150000" (rupees) → paise. Anything else → null. */
export function rupeesToPaise(s: string): number | null {
  const clean = s.replace(/[,\s₹]/g, "")
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(clean)) return null
  const [whole, frac = ""] = clean.split(".")
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"))
}

/** Paise → the rupee string used in the URL: 15000000 → "150000", 1050 → "10.5". */
export function paiseToRupees(p: number) {
  const whole = Math.floor(p / 100)
  const frac = p % 100
  return frac ? `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}` : String(whole)
}

export function parseInvoiceQuery(p: Params): InvoiceQuery {
  const rawView = get(p, "view")
  const view: InvoiceView = (INVOICE_VIEWS as readonly string[]).includes(rawView) ? (rawView as InvoiceView) : "all"

  const fromParam = get(p, "from")
  const toParam = get(p, "to")
  const rawPreset = get(p, "range")
  const custom = isISODate(fromParam) || isISODate(toParam)
  const preset: DatePreset = custom ? "custom" : (DATE_PRESETS as readonly string[]).includes(rawPreset) && rawPreset !== "custom" ? (rawPreset as DatePreset) : "all"

  let min = rupeesToPaise(get(p, "min"))
  let max = rupeesToPaise(get(p, "max"))
  if (min !== null && max !== null && min > max) [min, max] = [max, min]

  const rawSort = get(p, "sort")
  const fallback = defaultSort(view)
  const sort = (INVOICE_SORTS as readonly string[]).includes(rawSort) ? (rawSort as InvoiceSort) : fallback.sort
  const rawDir = get(p, "dir")
  const dir: SortDir = rawDir === "asc" || rawDir === "desc" ? rawDir : sort === fallback.sort ? fallback.dir : "asc"

  return {
    view,
    q: get(p, "q").trim().slice(0, 80),
    clients: get(p, "client")
      .split(",")
      .map((c) => c.trim())
      .filter((c) => /^[\w-]{1,64}$/.test(c))
      .slice(0, 50),
    preset,
    from: custom ? (isISODate(fromParam) ? fromParam : null) : null,
    to: custom ? (isISODate(toParam) ? toParam : null) : null,
    min,
    max,
    sort,
    dir,
    page: Math.max(1, Math.min(MAX_PAGES, Math.floor(Number(get(p, "page"))) || 1)),
  }
}

/** The issue-date bounds the query covers, as of `today`. */
export function issueRange(q: Pick<InvoiceQuery, "preset" | "from" | "to">, today: string) {
  return q.preset === "custom" ? { from: q.from, to: q.to } : presetRange(q.preset, today)
}

/**
 * The query string for `q` with `patch` applied, leaving out defaults so URLs
 * stay short. Changing anything but the page goes back to page 1; changing
 * the tab also drops a sort that was only that tab's default.
 */
export function invoiceQueryString(q: InvoiceQuery, patch: Partial<InvoiceQuery> = {}) {
  const next: InvoiceQuery = { ...q, ...patch }
  if (!("page" in patch)) next.page = 1
  if ("view" in patch && patch.view !== q.view && !("sort" in patch)) {
    const d = defaultSort(next.view)
    next.sort = d.sort
    next.dir = d.dir
  }
  const s = new URLSearchParams()
  if (next.view !== "all") s.set("view", next.view)
  if (next.q) s.set("q", next.q)
  if (next.clients.length) s.set("client", next.clients.join(","))
  if (next.preset === "custom") {
    if (next.from) s.set("from", next.from)
    if (next.to) s.set("to", next.to)
  } else if (next.preset !== "all") s.set("range", next.preset)
  if (next.min !== null) s.set("min", paiseToRupees(next.min))
  if (next.max !== null) s.set("max", paiseToRupees(next.max))
  const d = defaultSort(next.view)
  if (next.sort !== d.sort || next.dir !== d.dir) {
    s.set("sort", next.sort)
    s.set("dir", next.dir)
  }
  if (next.page > 1) s.set("page", String(next.page))
  return s.toString()
}

/** Filters beyond the tab: search, clients, dates, amounts. */
export function hasFilters(q: InvoiceQuery) {
  return !!q.q || q.clients.length > 0 || q.preset !== "all" || q.min !== null || q.max !== null
}

/* ------------------------------ sparklines ------------------------------ */

export type InsightInvoice = { id: string; total: number; amountPaid: number; issueDate: string; dueDate: string | null; status: string; balanceDue: number }
export type InsightPayment = { invoiceId: string; amount: number; paidOn: string }

const OPEN = new Set(["sent", "viewed", "partially_paid"])

/**
 * Weekly series for the KPI sparklines, worked out from today's balances
 * and the payments since: an invoice's balance on day t is its total, less
 * what's been paid by now, plus whatever arrived after t. Needs every
 * invoice that was unpaid at some point in the window (open ones, and paid
 * ones settled inside it) and the window's payments. `weeks` points, the
 * last one today.
 */
export function weeklySeries(invoices: InsightInvoice[], payments: InsightPayment[], today: string, weeks = 12) {
  const points = Array.from({ length: weeks }, (_, k) => addDays(today, -7 * (weeks - 1 - k)))
  const byInvoice = new Map<string, InsightPayment[]>()
  for (const p of payments) {
    const list = byInvoice.get(p.invoiceId)
    if (list) list.push(p)
    else byInvoice.set(p.invoiceId, [p])
  }
  const balanceOn = (inv: InsightInvoice, t: string) => {
    let later = 0
    for (const p of byInvoice.get(inv.id) ?? []) if (p.paidOn > t) later += p.amount
    return Math.max(0, inv.total - inv.amountPaid + later)
  }

  const outstanding: number[] = []
  const overdue: number[] = []
  const collected: number[] = []
  for (const t of points) {
    let out = 0
    let late = 0
    for (const inv of invoices) {
      if (inv.issueDate > t) continue
      const b = balanceOn(inv, t)
      out += b
      if (inv.dueDate && inv.dueDate < t) late += b
    }
    outstanding.push(out)
    overdue.push(late)
    const from = addDays(t, -6)
    collected.push(payments.reduce((s, p) => (p.paidOn >= from && p.paidOn <= t ? s + p.amount : s), 0))
  }

  // looking ahead: what falls due each week from today
  const ahead = Array.from({ length: 8 }, () => 0)
  let dueSoonAmount = 0
  let dueSoonCount = 0
  const horizon = addDays(today, UPCOMING_DAYS)
  for (const inv of invoices) {
    if (!OPEN.has(inv.status) || inv.balanceDue <= 0 || !inv.dueDate || inv.dueDate < today) continue
    if (inv.dueDate <= horizon) {
      dueSoonAmount += inv.balanceDue
      dueSoonCount++
    }
    for (let k = 0; k < ahead.length; k++) {
      if (inv.dueDate <= addDays(today, 7 * k + 6)) {
        ahead[k] += inv.balanceDue
        break
      }
    }
  }

  return { outstanding, overdue, collected, ahead, dueSoonAmount, dueSoonCount }
}

/* ------------------------------ calculations ----------------------------- */

export const CALCS = ["none", "sum", "avg", "min", "max", "count", "filled", "unique", "earliest", "latest"] as const
export type Calc = (typeof CALCS)[number]
export type ColumnKind = "money" | "date" | "text"

/** Which calculations make sense for a kind of column. */
export const CALCS_FOR: Record<ColumnKind, Calc[]> = {
  money: ["none", "sum", "avg", "min", "max", "count"],
  date: ["none", "earliest", "latest", "filled"],
  text: ["none", "count", "filled", "unique"],
}

export const CALC_LABEL: Record<Calc, string> = {
  none: "None",
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
  count: "Count",
  filled: "Not empty",
  unique: "Unique",
  earliest: "Earliest",
  latest: "Latest",
}

/** One footer cell. Numbers stay numbers (the caller formats); dates come back as yyyy-mm-dd. */
export function calculate(calc: Calc, values: (number | string | null)[]): number | string | null {
  const present = values.filter((v): v is number | string => v !== null && v !== "")
  switch (calc) {
    case "none":
      return null
    case "count":
      return values.length
    case "filled":
      return present.length
    case "unique":
      return new Set(present).size
    case "sum":
      return present.reduce<number>((s, v) => s + Number(v), 0)
    case "avg":
      return present.length ? Math.round(present.reduce<number>((s, v) => s + Number(v), 0) / present.length) : null
    case "min":
      return present.length ? Math.min(...present.map(Number)) : null
    case "max":
      return present.length ? Math.max(...present.map(Number)) : null
    case "earliest":
      return present.length ? String(present.reduce((a, b) => (String(b) < String(a) ? b : a))) : null
    case "latest":
      return present.length ? String(present.reduce((a, b) => (String(b) > String(a) ? b : a))) : null
  }
}
