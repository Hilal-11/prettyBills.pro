/**
 * Payment and receipt filters live in the URL, so a filtered view survives a
 * reload and can be shared or bookmarked. The page, the CSV export and the
 * totals all read them with this one parser.
 */
import { DATE_PRESETS, isISODate, presetRange, type DatePreset } from "./dates.ts"
import { isMode, type PaymentMode } from "./modes.ts"

type Params = Record<string, string | string[] | undefined> | URLSearchParams

export type ListFilters = {
  preset: DatePreset
  from: string | null
  to: string | null
  clients: string[]
  modes: PaymentMode[]
  q: string
  status: "active" | "void" | "all"
}

function get(p: Params, key: string) {
  const v = p instanceof URLSearchParams ? p.get(key) : p[key]
  return (Array.isArray(v) ? v[0] : v) ?? ""
}

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)

/** Defaults: this month (payments) or the last 30 days (receipts), active only. */
export function parseFilters(p: Params, today: string, defaults: { preset: DatePreset } = { preset: "this_month" }): ListFilters {
  const rawPreset = get(p, "range")
  const fromParam = get(p, "from")
  const toParam = get(p, "to")
  const custom = isISODate(fromParam) || isISODate(toParam)
  const preset: DatePreset = custom ? "custom" : (DATE_PRESETS as readonly string[]).includes(rawPreset) ? (rawPreset as DatePreset) : defaults.preset
  const range = preset === "custom" ? { from: isISODate(fromParam) ? fromParam : null, to: isISODate(toParam) ? toParam : null } : presetRange(preset, today)
  const status = get(p, "status")
  return {
    preset,
    from: range.from,
    to: range.to,
    clients: list(get(p, "client")).filter((c) => /^[\w-]{1,64}$/.test(c)).slice(0, 50),
    modes: list(get(p, "mode")).filter(isMode),
    q: get(p, "q").trim().slice(0, 80),
    status: status === "void" || status === "all" ? status : "active",
  }
}

/** The query string for a set of filters (without the cursor). */
export function filtersQuery(f: ListFilters, extra: Record<string, string> = {}) {
  const q = new URLSearchParams()
  if (f.preset === "custom") {
    if (f.from) q.set("from", f.from)
    if (f.to) q.set("to", f.to)
  } else q.set("range", f.preset)
  if (f.clients.length) q.set("client", f.clients.join(","))
  if (f.modes.length) q.set("mode", f.modes.join(","))
  if (f.q) q.set("q", f.q)
  if (f.status !== "active") q.set("status", f.status)
  for (const [k, v] of Object.entries(extra)) q.set(k, v)
  return q.toString()
}

export const STATEMENT_PERIODS = ["this_fy", "last_fy", "this_month", "last_month", "custom"] as const
export type StatementPeriod = (typeof STATEMENT_PERIODS)[number]

/** A statement's period from the URL. Default: this financial year to date. */
export function statementPeriod(p: Params, today: string): { period: StatementPeriod; from: string; to: string } {
  const raw = get(p, "period")
  const from = get(p, "from")
  const to = get(p, "to")
  if (raw === "custom" && isISODate(from) && isISODate(to) && from <= to) return { period: "custom", from, to }
  const period: StatementPeriod = (STATEMENT_PERIODS as readonly string[]).includes(raw) && raw !== "custom" ? (raw as StatementPeriod) : "this_fy"
  const r = presetRange(period as DatePreset, today)
  return { period, from: r.from ?? today, to: r.to ?? today }
}
