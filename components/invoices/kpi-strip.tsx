import { StatStrip, StatTile } from "@/components/app/stat-strip"

import { addDays, formatDate } from "@/lib/billing/dates"
import { formatINR } from "@/lib/billing/money"
import type { Overview } from "@/lib/data/types"
import type { InvoiceInsights } from "@/lib/server/db/invoices"

import { Sparkline } from "./sparkline"

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const money = (v: number) => formatINR(v, { decimals: false })
const dayMonth = (iso: string) => formatDate(iso).slice(0, 6)

/**
 * Four numbers above the invoices table, each with its 12-week trend, each
 * opening the rows behind it: what's owed, what's late, what came in this
 * month, and what falls due in the next 30 days.
 */
export function KpiStrip({ overview: o, insights: s, today, clientCredit = 0 }: { overview: Overview; insights: InvoiceInsights; today: string; clientCredit?: number }) {
  const past = s.outstanding.map((_, k) => `Week to ${dayMonth(addDays(today, -7 * (s.outstanding.length - 1 - k)))}`)
  const ahead = s.ahead.map((_, k) => (k === 0 ? "Next 7 days" : `Week from ${dayMonth(addDays(today, 7 * k))}`))
  const change = o.collectedLastMonth > 0 ? Math.round(((o.collectedMonth - o.collectedLastMonth) / o.collectedLastMonth) * 100) : null

  return (
    <StatStrip label="Totals">
      <StatTile
        href="/invoices?sort=balance&dir=desc"
        label="Outstanding"
        value={money(o.outstanding)}
        full={formatINR(o.outstanding)}
        note={`${o.outstandingCount ? `${plural(o.outstandingCount, "invoice")} waiting for payment` : "Nothing owed right now"}${clientCredit > 0 ? ` · Client credits ${money(clientCredit)}` : ""}`}
        spark={<Sparkline label="Outstanding, last 12 weeks" values={s.outstanding} labels={past} shown={s.outstanding.map(money)} />}
      />
      <StatTile
        href="/invoices?view=overdue"
        label="Overdue"
        value={money(o.overdueAmount)}
        full={formatINR(o.overdueAmount)}
        tone={o.overdue ? "danger" : undefined}
        note={o.overdue ? `${plural(o.overdue, "invoice")} · oldest ${plural(o.oldestOverdueDays, "day")} late` : "Nothing late"}
        spark={<Sparkline label="Overdue, last 12 weeks" values={s.overdue} labels={past} shown={s.overdue.map(money)} accent="fill-red-500" />}
      />
      <StatTile
        href="/payments?range=this_month"
        label="Collected this month"
        value={money(o.collectedMonth)}
        full={formatINR(o.collectedMonth)}
        note={
          o.avgDaysToPay !== null && o.avgDaysSample >= 3
            ? `Paid in ${plural(o.avgDaysToPay, "day")} on average`
            : change !== null
              ? `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs last month`
              : "From recorded payments"
        }
        spark={<Sparkline label="Collected per week, last 12 weeks" values={s.collected} labels={past} shown={s.collected.map(money)} accent="fill-emerald-500" />}
      />
      <StatTile
        href="/invoices?view=upcoming"
        label="Next 30 days"
        value={money(s.dueSoonAmount)}
        full={formatINR(s.dueSoonAmount)}
        note={s.dueSoonCount ? `${plural(s.dueSoonCount, "invoice")} falling due` : "Nothing falling due"}
        spark={<Sparkline label="Falling due per week, next 8 weeks" values={s.ahead} labels={ahead} shown={s.ahead.map(money)} />}
      />
    </StatStrip>
  )
}
