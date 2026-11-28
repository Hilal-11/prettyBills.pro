import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { AlarmClockIcon, ReceiptTextIcon, SearchXIcon } from "lucide-react"
import { cn } from "cn"

import { PageTabs, Toolbar } from "@/components/app/data-table"
import { TableEmpty } from "@/components/app/table-empty"
import { LoadMore } from "@/components/app/list-controls"
import { PageShell } from "@/components/app/page-shell"
import { StatStrip, StatTile } from "@/components/app/stat-strip"
import { EmptyState, GuestState } from "@/components/app/states"
import { FilterBar } from "@/components/payments/filter-bar"
import { ReceiptsGrid } from "@/components/receipts/receipts-grid"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PRESET_LABEL, todayIST } from "@/lib/billing/dates"
import { filtersQuery, parseFilters, type ListFilters } from "@/lib/billing/filters"
import { formatINR } from "@/lib/billing/money"
import { hasAnyReceipt, listReceipts, paymentSummary, receiptCounts } from "@/lib/server/db/payments"
import { dbMessage } from "@/lib/server/db/util"
import { listClients } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Receipts" }

const PAGE = 50
const money = (p: number) => formatINR(p, { decimals: false })

/**
 * Every receipt, edge to edge like Clients: status tabs (Active, Void, All)
 * with counts, filters in the toolbar, the headline numbers, then the table.
 * Receipts are made by recording payments, so there's no "new receipt".
 */
export default function ReceiptsPage({ searchParams }: PageProps<"/receipts">) {
  return (
    <PageShell crumbs={[{ label: "Receipts" }]} bleed>
      <Suspense fallback={<GridSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </PageShell>
  )
}

function Padded({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</div>
}

async function Body({ searchParams }: { searchParams: PageProps<"/receipts">["searchParams"] }) {
  const session = await getSession()
  if (!session)
    return (
      <Padded>
        <GuestState icon={ReceiptTextIcon} title="Receipts for every payment" body="Log in and record a payment on an invoice: a numbered receipt is made for you, ready to share on WhatsApp or by email." />
      </Padded>
    )

  const sp = await searchParams
  const today = todayIST()
  const filters = parseFilters(sp, today, { preset: "last_30" })
  const defaults = parseFilters({}, today, { preset: "last_30" })
  const sort = sp.sort === "amount" ? "amount" : "date"
  const page = Math.max(1, Math.min(40, Number(sp.page) || 1))

  let data: [Awaited<ReturnType<typeof listReceipts>>, Awaited<ReturnType<typeof listClients>>, Awaited<ReturnType<typeof receiptCounts>>, Awaited<ReturnType<typeof paymentSummary>>]
  try {
    data = await Promise.all([listReceipts(session.db, filters, { sort, limit: PAGE * page }), listClients(session.db), receiptCounts(session.db, filters), paymentSummary(session.db, filters)])
  } catch (error) {
    return (
      <Padded>
        <EmptyState icon={AlarmClockIcon} title="Couldn't load your receipts" body={dbMessage(error)} />
      </Padded>
    )
  }
  const [{ receipts, hasMore }, clients, counts, summary] = data

  if (!receipts.length && !(await hasAnyReceipt(session.db).catch(() => true))) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TableEmpty icon={ReceiptTextIcon} title="No receipts yet" body="Receipts are created automatically when you record a payment on an invoice.">
          <Link href="/invoices?view=sent" className={cn(buttonVariants(), "mt-2 h-8 px-3 text-[13px]")}>
            Go to invoices
          </Link>
        </TableEmpty>
      </div>
    )
  }

  const href = (patch: Partial<ListFilters>, extra: Record<string, string> = {}) => `/receipts?${filtersQuery({ ...filters, ...patch }, { ...(sort === "amount" ? { sort: "amount" } : {}), ...extra })}`
  const period = filters.preset === "custom" ? "this period" : PRESET_LABEL[filters.preset].toLowerCase()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar
        tabs={
          <PageTabs
            label="Receipt status"
            active={filters.status}
            tabs={[
              { id: "active", label: "Active", href: href({ status: "active" }), count: counts.active },
              { id: "void", label: "Void", href: href({ status: "void" }), count: counts.void },
              { id: "all", label: "All", href: href({ status: "all" }), count: counts.active + counts.void },
            ]}
          />
        }
      >
        <FilterBar inline filters={filters} defaults={defaults} clients={clients.map((c) => ({ id: c.id, name: c.name }))} searchPlaceholder="Search receipts" />
      </Toolbar>

      <StatStrip label="Totals for these filters">
        <StatTile label="Receipts" value={counts.active.toLocaleString("en-IN")} note={`Active · ${period}`} />
        <StatTile label="Received" value={money(summary.total)} full={formatINR(summary.total)} tone={summary.total ? "good" : undefined} note={summary.tds ? `+ ${money(summary.tds)} TDS = ${money(summary.settled)} settled` : "Money that reached you"} href={`/payments?${filtersQuery({ ...filters, status: "active" })}`} />
        <StatTile label="Emailed" value={counts.emailed.toLocaleString("en-IN")} note={counts.active ? `${Math.round((counts.emailed / counts.active) * 100)}% of active receipts sent to clients` : "None yet"} />
        <StatTile label="Void" value={counts.void.toLocaleString("en-IN")} note={counts.void ? "From deleted payments; numbers stay used" : "Nothing voided"} href={counts.void ? href({ status: "void" }) : undefined} />
      </StatStrip>

      {receipts.length ? (
        <ReceiptsGrid
          receipts={receipts}
          sort={sort}
          sortHrefs={{ date: `/receipts?${filtersQuery(filters)}`, amount: `/receipts?${filtersQuery(filters, { sort: "amount" })}` }}
          after={hasMore ? <LoadMore /> : undefined}
        />
      ) : (
        <TableEmpty icon={SearchXIcon} title="No receipts match these filters" body="Try a wider date range or another status.">
          <Link href="/receipts" className={cn(buttonVariants({ variant: "outline" }), "mt-2 h-8 px-3 text-[13px]")}>
            Clear filters
          </Link>
        </TableEmpty>
      )}
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Loading receipts">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="h-7 w-52 rounded-md" />
        <Skeleton className="ml-auto hidden h-8 w-[30rem] rounded-lg md:block" />
      </div>
      <div className="grid grid-cols-2 border-b lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="grid gap-2 border-r px-4 py-3 last:border-r-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex h-10 items-center gap-6 border-b px-4">
          <Skeleton className="h-3.5 w-4" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="ml-auto h-3.5 w-20" />
        </div>
      ))}
    </div>
  )
}
