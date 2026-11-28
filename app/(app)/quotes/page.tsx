import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { AlarmClockIcon, PlusIcon, RotateCcwIcon, ScrollTextIcon, SearchXIcon } from "lucide-react"
import { cn } from "cn"

import { PageTabs, Toolbar } from "@/components/app/data-table"
import { ListSearch, LoadMore } from "@/components/app/list-controls"
import { PageShell } from "@/components/app/page-shell"
import { StatStrip, StatTile } from "@/components/app/stat-strip"
import { EmptyState, GuestState } from "@/components/app/states"
import { TableEmpty } from "@/components/app/table-empty"
import { QuoteFilters, QuoteSettingsButton } from "@/components/quotes/quote-toolbar"
import { QuotesGrid } from "@/components/quotes/quotes-grid"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DATE_PRESETS, presetRange, type DatePreset } from "@/lib/billing/dates"
import { formatINR } from "@/lib/billing/money"
import type { QuoteKind } from "@/lib/invoice/types"
import { getPlan } from "@/lib/server/billing"
import { getQuoteSettings, hasAnyQuote, listQuotes, QUOTE_TABS, quoteStats, type QuoteTab } from "@/lib/server/db/quotes"
import { dbMessage, today } from "@/lib/server/db/util"
import { listClients } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Quotes & proforma" }

const PAGE = 50
const money = (p: number) => formatINR(p, { decimals: false })

/** Quotes and proforma invoices, edge to edge like Credit notes: kind tabs, the numbers, status tabs, the table. */
export default function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  return (
    <PageShell crumbs={[{ label: "Quotes & proforma" }]} bleed>
      <Suspense fallback={<ListSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </PageShell>
  )
}

async function Body({ searchParams }: { searchParams: PageProps<"/quotes">["searchParams"] }) {
  const session = await getSession()
  if (!session)
    return (
      <div className="overflow-y-auto px-4 py-6 sm:px-6">
        <GuestState icon={ScrollTextIcon} title="Quotes your clients can accept online" body="Log in to send quotes and proforma invoices, get a yes in one click, and turn them into invoices without retyping anything." />
      </div>
    )
  const sp = await searchParams
  const kind: QuoteKind = sp.kind === "proforma" ? "proforma" : "quote"
  const tab: QuoteTab = (QUOTE_TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as QuoteTab) : "all"
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : ""
  const clientId = typeof sp.client === "string" && /^[\w-]{1,64}$/.test(sp.client) ? sp.client : undefined
  const preset = (DATE_PRESETS as readonly string[]).includes(String(sp.date)) ? (sp.date as DatePreset) : "all"
  const expiringSoon = kind === "quote" && sp.expiring === "1"
  const page = Math.max(1, Math.min(20, Number(sp.page) || 1))
  const range = preset === "all" ? { from: null, to: null } : presetRange(preset, today())

  let data: [Awaited<ReturnType<typeof listQuotes>>, Awaited<ReturnType<typeof quoteStats>>, Awaited<ReturnType<typeof listClients>>, Awaited<ReturnType<typeof getQuoteSettings>>, boolean]
  try {
    data = await Promise.all([
      listQuotes(session.db, { kind, tab, q, clientId, from: range.from, to: range.to, expiringSoon }, { limit: PAGE * page }),
      quoteStats(session.db, kind),
      listClients(session.db),
      getQuoteSettings(session.db),
      getPlan(session.db, session.userId).then((p) => p.pro),
    ])
  } catch (error) {
    return (
      <div className="overflow-y-auto px-4 py-6 sm:px-6">
        <EmptyState icon={AlarmClockIcon} title="Couldn't load your quotes" body={dbMessage(error)}>
          <Link href={`/quotes${kind === "proforma" ? "?kind=proforma" : ""}`} className={cn(buttonVariants({ variant: "outline" }), "mt-5 h-8 gap-1.5 px-3 text-[13px]")}>
            <RotateCcwIcon className="size-3.5" /> Retry
          </Link>
        </EmptyState>
      </div>
    )
  }
  const [{ quotes, total }, stats, clients, settings, pro] = data

  const keep = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const all = { kind: kind === "proforma" ? "proforma" : undefined, q: q || undefined, client: clientId, date: preset !== "all" ? preset : undefined, ...extra }
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v)
    return `/quotes${p.size ? `?${p}` : ""}`
  }
  const newHref = `/quotes/new?kind=${kind}${clientId ? `&client=${clientId}` : ""}`
  const newButton = (
    <Link href={newHref} className={cn(buttonVariants(), "h-8 gap-1.5 px-3 text-[13px]")}>
      <PlusIcon /> <span className="hidden sm:inline">{kind === "quote" ? "New quote" : "New proforma"}</span>
    </Link>
  )
  const kindTabs = (
    <PageTabs
      label="Document type"
      active={kind}
      tabs={[
        { id: "quote", label: "Quotes", href: "/quotes" },
        { id: "proforma", label: "Proforma", href: "/quotes?kind=proforma" },
      ]}
    />
  )
  const c = stats.counts
  const filtered = !!(q || clientId || preset !== "all" || expiringSoon || tab !== "all")

  if (c.all === 0 && !(await hasAnyQuote(session.db, kind).catch(() => true)))
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Toolbar tabs={kindTabs}>
          <QuoteSettingsButton settings={settings} pro={pro} />
          {newButton}
        </Toolbar>
        <TableEmpty
          icon={ScrollTextIcon}
          title={kind === "quote" ? "No quotes yet" : "No proforma invoices yet"}
          body={kind === "quote" ? "Send a price offer your client can accept online, then turn it into an invoice in one click." : "Ask for an advance or a go-ahead before the final invoice. Proformas aren't tax invoices."}
        >
          <Link href={newHref} className={cn(buttonVariants(), "mt-2 h-8 gap-1.5 px-3 text-[13px]")}>
            <PlusIcon /> {kind === "quote" ? "New quote" : "New proforma"}
          </Link>
        </TableEmpty>
      </div>
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar tabs={kindTabs}>
        <ListSearch placeholder="Search number, client or item" className="sm:w-60" />
        <QuoteSettingsButton settings={settings} pro={pro} />
        {newButton}
      </Toolbar>

      <StatStrip label={kind === "quote" ? "Quote totals" : "Proforma totals"}>
        <StatTile label="Open" value={money(stats.openTotal)} full={formatINR(stats.openTotal)} note={`${stats.openCount} waiting for an answer`} href={keep({ tab: "open" })} />
        <StatTile label="Accepted this month" value={money(stats.acceptedMonth)} full={formatINR(stats.acceptedMonth)} tone={stats.acceptedMonth ? "good" : undefined} note={`${stats.acceptedMonthCount} accepted`} href={keep({ tab: "accepted" })} />
        {kind === "quote" ? (
          <StatTile label="Conversion rate" value={stats.conversionRate === null ? "—" : `${Math.round(stats.conversionRate * 100)}%`} note="Accepted ÷ answered, last 90 days" />
        ) : (
          <StatTile label="Converted" value={c.converted.toLocaleString("en-IN")} note="Turned into invoices" href={keep({ tab: "converted" })} />
        )}
        {kind === "quote" ? (
          <StatTile label="Expiring in 7 days" value={stats.expiringSoon.toLocaleString("en-IN")} tone={stats.expiringSoon ? "danger" : undefined} note={stats.expiringSoon ? "Follow up before they lapse" : "Nothing about to lapse"} href={stats.expiringSoon ? keep({ expiring: "1" }) : undefined} />
        ) : (
          <StatTile label="Drafts" value={c.draft.toLocaleString("en-IN")} note="Not sent yet" href={c.draft ? keep({ tab: "draft" }) : undefined} />
        )}
      </StatStrip>

      <Toolbar
        tabs={
          <PageTabs
            label="Status"
            active={expiringSoon ? "" : tab}
            tabs={[
              { id: "all", label: "All", href: keep({}), count: c.all },
              { id: "draft", label: "Drafts", href: keep({ tab: "draft" }), count: c.draft },
              { id: "open", label: "Open", href: keep({ tab: "open" }), count: c.open },
              { id: "accepted", label: "Accepted", href: keep({ tab: "accepted" }), count: c.accepted },
              ...(kind === "quote" ? [{ id: "declined", label: "Declined", href: keep({ tab: "declined" }), count: c.declined }] : []),
              { id: "converted", label: "Converted", href: keep({ tab: "converted" }), count: c.converted },
              ...(kind === "quote" ? [{ id: "expired", label: "Expired", href: keep({ tab: "expired" }), count: c.expired, danger: true }] : []),
              { id: "void", label: "Void", href: keep({ tab: "void" }), count: c.void },
            ]}
          />
        }
      >
        <QuoteFilters clients={clients.map((cl) => ({ id: cl.id, name: cl.name }))} kind={kind} />
      </Toolbar>

      {quotes.length ? (
        <QuotesGrid quotes={quotes} after={quotes.length < total ? <LoadMore /> : undefined} />
      ) : (
        <TableEmpty icon={SearchXIcon} title={filtered ? "Nothing matches these filters" : "Nothing here"} body={filtered ? "Try another tab, a wider date range or a different search." : "Quotes you send show up here."}>
          <Link href={kind === "proforma" ? "/quotes?kind=proforma" : "/quotes"} className={cn(buttonVariants({ variant: "outline" }), "mt-2 h-8 px-3 text-[13px]")}>
            Clear filters
          </Link>
        </TableEmpty>
      )}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Loading quotes">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="h-7 w-44 rounded-md" />
        <Skeleton className="ml-auto hidden h-8 w-96 rounded-lg md:block" />
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
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="h-7 w-[28rem] rounded-md" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-10 items-center gap-6 border-b px-4">
          <Skeleton className="h-3.5 w-4" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="ml-auto h-3.5 w-20" />
        </div>
      ))}
    </div>
  )
}
