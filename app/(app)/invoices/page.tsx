import { Suspense } from "react"
import type { Metadata } from "next"
import { AlarmClockIcon, FileTextIcon } from "lucide-react"

import { PageShell } from "@/components/app/page-shell"
import { EmptyState, GuestState } from "@/components/app/states"
import { InvoicesView } from "@/components/invoices/invoices-view"
import { KpiStrip } from "@/components/invoices/kpi-strip"
import { Skeleton } from "@/components/ui/skeleton"
import { parseInvoiceQuery, type InvoiceView } from "@/lib/billing/invoice-query"
import { getOverview, invoiceInsights, paymentMethods, queryInvoices } from "@/lib/server/db/invoices"
import { dbMessage, today } from "@/lib/server/db/util"
import { listClients } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Invoices" }

const PAGE = 100

/**
 * Every invoice in one table, edge to edge: tabs for drafts, sent, overdue,
 * paid, upcoming (and void), the four numbers that matter with their trends,
 * then search, filters, sorting, column choices, footer totals, bulk actions
 * and CSV export. All of it lives in the URL (lib/billing/invoice-query).
 */
export default function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  return (
    <PageShell crumbs={[{ label: "Invoices" }]} bleed>
      <Suspense fallback={<TableSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </PageShell>
  )
}

async function Body({ searchParams }: { searchParams: PageProps<"/invoices">["searchParams"] }) {
  const session = await getSession()
  if (!session)
    return (
      <div className="overflow-y-auto px-4 py-8">
        <GuestState icon={FileTextIcon} title="Your invoices live here" body="Log in and every invoice you make is saved, sorted into drafts, sent, overdue and paid, and searchable." />
      </div>
    )

  const query = parseInvoiceQuery(await searchParams)
  let data: [Awaited<ReturnType<typeof queryInvoices>>, Awaited<ReturnType<typeof getOverview>>, Awaited<ReturnType<typeof invoiceInsights>>, Awaited<ReturnType<typeof listClients>>]
  try {
    data = await Promise.all([queryInvoices(session.db, query, { limit: PAGE * query.page }), getOverview(session.db), invoiceInsights(session.db), listClients(session.db)])
  } catch (error) {
    return (
      <div className="overflow-y-auto px-4 py-8">
        <EmptyState icon={AlarmClockIcon} title="Couldn't load your invoices" body={dbMessage(error)} />
      </div>
    )
  }
  const [{ invoices, total }, overview, insights, clients] = data
  const methods = await paymentMethods(
    session.db,
    invoices.filter((i) => i.amountPaid > 0).map((i) => i.id)
  ).catch(() => ({}))

  const counts: Record<InvoiceView, number> = {
    all: overview.all,
    draft: overview.drafts,
    sent: overview.sent,
    overdue: overview.overdue,
    paid: overview.paid,
    upcoming: insights.dueSoonCount,
    void: insights.voided,
  }

  return (
    <InvoicesView
      query={query}
      counts={counts}
      rows={invoices}
      total={total}
      methods={methods}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      kpis={overview.all > 0 ? <KpiStrip overview={overview} insights={insights} today={today()} /> : null}
    />
  )
}

function TableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading invoices" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="h-7 w-96 rounded-md" />
        <Skeleton className="ml-auto hidden h-8 w-[28rem] rounded-lg md:block" />
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
      <div className="grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex h-10 items-center gap-6 border-b px-4">
            <Skeleton className="h-3.5 w-4" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="ml-auto h-3.5 w-20" />
            <Skeleton className="hidden h-3.5 w-24 md:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
