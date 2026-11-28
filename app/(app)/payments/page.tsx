import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { AlarmClockIcon, ArrowLeftIcon, ArrowRightIcon, DownloadIcon, SearchXIcon, WalletIcon } from "lucide-react"
import { cn } from "cn"

import { PageTabs, Toolbar } from "@/components/app/data-table"
import { TableEmpty } from "@/components/app/table-empty"
import { PageShell } from "@/components/app/page-shell"
import { StatStrip, StatTile } from "@/components/app/stat-strip"
import { EmptyState, GuestState } from "@/components/app/states"
import { FilterBar } from "@/components/payments/filter-bar"
import { PaymentsGrid } from "@/components/payments/payments-grid"
import { RecordPaymentButton } from "@/components/payments/record-button"
import { TdsReport } from "@/components/payments/tds-report"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fyLabel, fyRange, PRESET_LABEL, todayIST } from "@/lib/billing/dates"
import { filtersQuery, parseFilters } from "@/lib/billing/filters"
import { MODE_SHORT, PAYMENT_MODES } from "@/lib/billing/modes"
import { formatINR } from "@/lib/billing/money"
import { QUARTERS, tdsReport } from "@/lib/billing/tds"
import { listPayments, listTdsPayments, paymentSummary } from "@/lib/server/db/payments"
import { dbMessage } from "@/lib/server/db/util"
import { listClients } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Payments" }

type SP = Record<string, string | string[] | undefined>

/** ?tab=tds → the TDS tab; ?fy=26-27 picks its financial year (default: this one). */
function tdsTab(sp: SP, today: string) {
  const fyParam = typeof sp.fy === "string" && /^\d{2}-\d{2}$/.test(sp.fy) ? sp.fy : null
  const fy = fyParam ?? fyLabel(today)
  const { from, to } = fyRange(`20${fy.slice(0, 2)}-04-01`)
  return { on: sp.tab === "tds", fy, from, to }
}

const money = (p: number) => formatINR(p, { decimals: false })
const btn = cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-2.5 text-[13px] font-normal")

/**
 * Every payment received, edge to edge like Clients: tabs (All payments,
 * TDS), filters and actions in one toolbar row, the headline numbers, then
 * the table. Filters live in the URL; the list pages by cursor.
 */
export default function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  return (
    <PageShell crumbs={[{ label: "Payments" }]} bleed>
      <Suspense fallback={<GridSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </PageShell>
  )
}

function Padded({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</div>
}

const tabs = (active: "all" | "tds", count?: number) => <PageTabs label="Payment views" active={active} tabs={[{ id: "all", label: "All payments", href: "/payments", count }, { id: "tds", label: "TDS", href: "/payments?tab=tds" }]} />

async function Body({ searchParams }: { searchParams: PageProps<"/payments">["searchParams"] }) {
  const session = await getSession()
  if (!session)
    return (
      <Padded>
        <GuestState icon={WalletIcon} title="Track what you've been paid" body="Log in to record payments against your invoices. Each one gets a numbered receipt you can share, and your balances update by themselves." />
      </Padded>
    )

  const sp = await searchParams
  const today = todayIST()
  const tds = tdsTab(sp, today)
  if (tds.on) return <TdsTab fy={tds.fy} from={tds.from} to={tds.to} today={today} />

  const filters = parseFilters(sp, today)
  const defaults = parseFilters({}, today)
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined
  const f = { ...filters, hasTds: filters.tds }

  let data: [Awaited<ReturnType<typeof listPayments>>, Awaited<ReturnType<typeof paymentSummary>>, Awaited<ReturnType<typeof listClients>>]
  try {
    data = await Promise.all([listPayments(session.db, f, { cursor }), paymentSummary(session.db, f), listClients(session.db)])
  } catch (error) {
    return (
      <Padded>
        <EmptyState icon={AlarmClockIcon} title="Couldn't load your payments" body={dbMessage(error)} />
      </Padded>
    )
  }
  const [{ payments, next }, summary, clients] = data
  const filtered = filtersQuery(filters) !== filtersQuery(defaults)

  if (!payments.length && !cursor && !filtered) {
    const anyEver = await paymentSummary(session.db, { ...filters, from: null, to: null }).catch(() => ({ count: 0 }))
    if (!anyEver.count)
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <Toolbar tabs={tabs("all", 0)}>
            <RecordPaymentButton />
          </Toolbar>
          <TableEmpty icon={WalletIcon} title="No payments yet" body="Record your first payment from any sent invoice. The invoice's balance and status update straight away, and a receipt is made for you.">
            <Link href="/invoices?view=sent" className={cn(buttonVariants(), "mt-2 h-8 px-3 text-[13px]")}>
              Go to invoices
            </Link>
          </TableEmpty>
        </div>
      )
  }

  const modes = PAYMENT_MODES.filter((m) => summary.byMode[m]).sort((a, b) => (summary.byMode[b] ?? 0) - (summary.byMode[a] ?? 0))
  const period = filters.preset === "custom" ? "this period" : PRESET_LABEL[filters.preset].toLowerCase()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar tabs={tabs("all", summary.count)}>
        <FilterBar inline filters={filters} defaults={defaults} clients={clients.map((c) => ({ id: c.id, name: c.name }))} searchPlaceholder="Search payments" tdsFilter>
          <a href={`/api/payments/export?${filtersQuery(filters)}`} download className={btn} title="Download these payments as CSV">
            <DownloadIcon className="text-muted-foreground" /> <span className="hidden sm:inline">Export</span>
          </a>
          <RecordPaymentButton />
        </FilterBar>
      </Toolbar>

      <StatStrip label="Totals for these filters">
        <StatTile label="Received" value={money(summary.total)} full={formatINR(summary.total)} note={`${summary.count} payment${summary.count === 1 ? "" : "s"} · ${period}`} />
        <StatTile label="TDS deducted" value={money(summary.tds)} full={formatINR(summary.tds)} note={summary.tds ? "Settled by clients' TDS" : "No TDS in these payments"} href={summary.tds ? "/payments?tab=tds" : undefined} />
        <StatTile label="Total settled" value={money(summary.settled)} full={formatINR(summary.settled)} tone={summary.settled ? "good" : undefined} note="Received + TDS" />
        <StatTile label="By mode" value={modes[0] ? MODE_SHORT[modes[0]] : "—"} note={modes.length ? modes.map((m) => `${MODE_SHORT[m]} ${money(summary.byMode[m] ?? 0)}`).join(" · ") : "Nothing received yet"} />
      </StatStrip>

      {payments.length ? (
        <PaymentsGrid
          payments={payments}
          totals={{ received: summary.total, tds: summary.tds, settled: summary.settled, count: summary.count }}
          footerNote={next || cursor ? `Showing ${payments.length} on this page` : undefined}
          after={
            (next || cursor) && (
              <nav aria-label="Pages" className="flex items-center justify-center gap-2 px-3 py-4">
                {cursor && (
                  <Link href={`/payments?${filtersQuery(filters)}`} className={cn(buttonVariants({ variant: "outline" }), "h-7 gap-1.5 px-2.5 text-xs")}>
                    <ArrowLeftIcon /> Newest
                  </Link>
                )}
                {next && (
                  <Link href={`/payments?${filtersQuery(filters, { cursor: next })}`} className={cn(buttonVariants({ variant: "outline" }), "h-7 gap-1.5 px-2.5 text-xs")}>
                    Older payments <ArrowRightIcon />
                  </Link>
                )}
              </nav>
            )
          }
        />
      ) : (
        <TableEmpty icon={SearchXIcon} title="No payments match these filters" body="Try a wider date range, or clear the filters to see everything.">
          <Link href="/payments" className={cn(buttonVariants({ variant: "outline" }), "mt-2 h-8 px-3 text-[13px]")}>
            Clear filters
          </Link>
        </TableEmpty>
      )}
    </div>
  )
}

/** TDS clients deducted in a financial year, by quarter and client, with certificate tracking. */
async function TdsTab({ fy, from, to, today }: { fy: string; from: string; to: string; today: string }) {
  const session = (await getSession())!
  let payments: Awaited<ReturnType<typeof listTdsPayments>>
  try {
    payments = await listTdsPayments(session.db, from, to)
  } catch (error) {
    return (
      <Padded>
        <EmptyState icon={AlarmClockIcon} title="Couldn't load TDS" body={dbMessage(error)} />
      </Padded>
    )
  }
  const current = fyLabel(today)
  const prev = fyLabel(`20${current.slice(0, 2)}-03-31`)
  const fys = [current, prev, fyLabel(`20${prev.slice(0, 2)}-03-31`)]
  const quarters = tdsReport(payments)
  const fyTabs = (
    <div role="group" aria-label="Financial year" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {fys.map((f) => (
        <Link key={f} href={`/payments?tab=tds&fy=${f}`} aria-current={f === fy ? "page" : undefined} className={cn("inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium tabular-nums transition-colors", f === fy ? "border bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>
          FY {f}
        </Link>
      ))}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar tabs={tabs("tds")}>
        {fyTabs}
        <a href={`/api/payments/tds-export?fy=${fy}`} download className={btn} title="Download every TDS deduction in this FY as CSV">
          <DownloadIcon className="text-muted-foreground" /> <span className="hidden sm:inline">Export</span>
        </a>
      </Toolbar>
      <StatStrip label={`TDS by quarter, FY ${fy}`}>
        {quarters.map((q) => (
          <StatTile key={q.q} label={`${q.label} · ${q.months}`} value={money(q.total)} full={formatINR(q.total)} note={q.rows.length ? `${q.rows.length} client${q.rows.length === 1 ? "" : "s"} · ${q.rows.filter((r) => r.certificate !== "all").length} certificate${q.rows.filter((r) => r.certificate !== "all").length === 1 ? "" : "s"} pending` : "No TDS"} />
        ))}
      </StatStrip>
      {payments.length ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TdsReport quarters={quarters} fy={fy} />
        </div>
      ) : (
        <TableEmpty icon={WalletIcon} title={`No TDS in FY ${fy}`} body="When a client deducts TDS, turn on “Client deducted TDS” while recording their payment. It shows up here by quarter, ready to match with Form 26AS." />
      )}
    </div>
  )
}

/** Quarters are fixed, so the skeleton matches the real layout. */
function GridSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Loading payments">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="h-7 w-44 rounded-md" />
        <Skeleton className="ml-auto hidden h-8 w-[34rem] rounded-lg md:block" />
      </div>
      <div className="grid grid-cols-2 border-b lg:grid-cols-4">
        {QUARTERS.map((q) => (
          <div key={q.q} className="grid gap-2 border-r px-4 py-3 last:border-r-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex h-10 items-center gap-6 border-b px-4">
          <Skeleton className="h-3.5 w-4" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="ml-auto h-3.5 w-20" />
        </div>
      ))}
    </div>
  )
}
