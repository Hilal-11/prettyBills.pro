/**
 * Numbers behind the dashboard charts, worked out from the user's invoices
 * and payments. Pure (no I/O), so it's tested in billing.test.ts and runs
 * on the server; the client only draws the result.
 */
import { daysBetween } from "./dates.ts"
import { PAYMENT_MODES, type PaymentMode } from "./modes.ts"

export type DashInvoice = {
  id: string
  clientId: string | null
  clientName: string
  status: string
  bucket: string
  total: number
  amountPaid: number
  balanceDue: number
  issueDate: string
  dueDate: string | null
  /** yyyy-mm-dd in IST, or null. */
  paidOn: string | null
}

export type DashPayment = { amount: number; paidOn: string; mode: PaymentMode }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const OPEN = new Set(["sent", "viewed", "partially_paid"])

/** The last `n` calendar months as yyyy-mm, oldest first, ending with this month. */
export function lastMonths(today: string, n: number) {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7)) - 1
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(Date.UTC(y, m - (n - 1 - k), 1))
    return d.toISOString().slice(0, 7)
  })
}

/** "Nov", or "Jan 26" at a year boundary so a 12-month axis reads clearly. */
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]}${key.endsWith("-01") ? ` ${key.slice(2, 4)}` : ""}`

export const AGEING = [
  { key: "current", label: "Not yet due" },
  { key: "d30", label: "1–30 days" },
  { key: "d60", label: "31–60 days" },
  { key: "d90", label: "61–90 days" },
  { key: "d90p", label: "90+ days" },
] as const
export type AgeingKey = (typeof AGEING)[number]["key"]

export const STATUS_ORDER = ["draft", "sent", "overdue", "paid", "void"] as const
export type StatusKey = (typeof STATUS_ORDER)[number]

export type DashboardCharts = ReturnType<typeof buildDashboard>

export function buildDashboard(invoices: DashInvoice[], payments: DashPayment[], today: string) {
  const months = lastMonths(today, 12)
  const at = new Map(months.map((k, i) => [k, i]))
  const monthly = months.map((key) => ({ key, label: monthLabel(key), invoiced: 0, collected: 0, raised: 0 }))
  const ageing = Object.fromEntries(AGEING.map((a) => [a.key, { amount: 0, count: 0 }])) as Record<AgeingKey, { amount: number; count: number }>
  const status = Object.fromEntries(STATUS_ORDER.map((s) => [s, { amount: 0, count: 0 }])) as Record<StatusKey, { amount: number; count: number }>
  const clients = new Map<string, { id: string | null; name: string; billed: number; outstanding: number; overdue: number; invoices: number }>()
  const paidDays = months.map(() => ({ sum: 0, n: 0 }))

  for (const i of invoices) {
    const s = (STATUS_ORDER as readonly string[]).includes(i.bucket) ? (i.bucket as StatusKey) : "sent"
    status[s].count++
    status[s].amount += s === "sent" || s === "overdue" ? i.balanceDue : i.total
    if (i.status === "draft" || i.status === "void") continue

    const m = at.get(i.issueDate.slice(0, 7))
    if (m !== undefined) {
      monthly[m].invoiced += i.total
      monthly[m].raised++
    }

    if (OPEN.has(i.status) && i.balanceDue > 0) {
      const late = i.dueDate ? daysBetween(i.dueDate, today) : 0
      const key: AgeingKey = late <= 0 ? "current" : late <= 30 ? "d30" : late <= 60 ? "d60" : late <= 90 ? "d90" : "d90p"
      ageing[key].amount += i.balanceDue
      ageing[key].count++
    }

    const ck = i.clientId ?? `name:${i.clientName.trim().toLowerCase()}`
    if (i.clientId || i.clientName.trim()) {
      const c = clients.get(ck) ?? { id: i.clientId, name: i.clientName || "Unnamed", billed: 0, outstanding: 0, overdue: 0, invoices: 0 }
      c.billed += i.total
      c.invoices++
      if (OPEN.has(i.status)) c.outstanding += i.balanceDue
      if (i.bucket === "overdue") c.overdue += i.balanceDue
      clients.set(ck, c)
    }

    if (i.status === "paid" && i.paidOn) {
      const pm = at.get(i.paidOn.slice(0, 7))
      if (pm !== undefined) {
        paidDays[pm].sum += Math.max(0, daysBetween(i.issueDate, i.paidOn))
        paidDays[pm].n++
      }
    }
  }

  const byMode = new Map<PaymentMode, { amount: number; count: number }>()
  for (const p of payments) {
    const m = at.get(p.paidOn.slice(0, 7))
    if (m === undefined) continue
    monthly[m].collected += p.amount
    const s = byMode.get(p.mode) ?? { amount: 0, count: 0 }
    s.amount += p.amount
    s.count++
    byMode.set(p.mode, s)
  }

  return {
    monthly,
    ageing,
    status,
    // colour follows the mode, so keep the fixed order and drop the empty ones
    methods: PAYMENT_MODES.filter((m) => byMode.has(m)).map((mode) => ({ mode, ...byMode.get(mode)! })),
    topClients: [...clients.values()].sort((a, b) => b.billed - a.billed || a.name.localeCompare(b.name)).slice(0, 6),
    daysToPay: months.map((key, k) => ({ key, label: monthLabel(key), days: paidDays[k].n ? Math.round(paidDays[k].sum / paidDays[k].n) : null, invoices: paidDays[k].n })),
  }
}
