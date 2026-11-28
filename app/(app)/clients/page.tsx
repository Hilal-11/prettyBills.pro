import { Suspense } from "react"
import type { Metadata } from "next"
import { AlarmClockIcon, UsersIcon } from "lucide-react"

import { PageShell } from "@/components/app/page-shell"
import { StatStrip, StatTile } from "@/components/app/stat-strip"
import { EmptyState, GuestState } from "@/components/app/states"
import { ClientsView } from "@/components/clients/clients-view"
import { Skeleton } from "@/components/ui/skeleton"
import type { ClientWithStats } from "@/lib/data/types"
import { formatMoney } from "@/lib/invoice/totals"
import { dbMessage } from "@/lib/server/db/util"
import { listClientsWithStats } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Clients" }

const money = (p: number) => formatMoney(p, { whole: true })
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`

/** Everyone you bill, edge to edge like invoices: headline numbers, then the table. `?new=1` opens "Add client". */
export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
  return (
    <PageShell crumbs={[{ label: "Clients" }]} bleed>
      <Suspense fallback={<ClientsSkeleton />}>
        <Clients searchParams={searchParams} />
      </Suspense>
    </PageShell>
  )
}

async function Clients({ searchParams }: { searchParams: PageProps<"/clients">["searchParams"] }) {
  const session = await getSession()
  if (!session)
    return (
      <div className="overflow-y-auto px-4 py-8">
        <GuestState icon={UsersIcon} title="Keep your clients in one place" body="Log in to save the people you bill. Their GSTIN and address fill in with one click, and you can see who owes you what." />
      </div>
    )
  const [data, sp] = await Promise.all([listClientsWithStats(session.db).catch((error: unknown) => error), searchParams])
  if (!Array.isArray(data))
    return (
      <div className="overflow-y-auto px-4 py-8">
        <EmptyState icon={AlarmClockIcon} title="Couldn't load your clients" body={dbMessage(data)} />
      </div>
    )
  const clients = data as ClientWithStats[]
  const owed = clients.reduce((s, c) => s + c.outstanding, 0)
  const late = clients.reduce((s, c) => s + c.overdue, 0)
  const billed = clients.reduce((s, c) => s + c.billed, 0)
  const owing = clients.filter((c) => c.outstanding > 0).length
  const lateCount = clients.filter((c) => c.overdue > 0).length
  const billedCount = clients.filter((c) => c.invoices > 0).length

  return (
    <ClientsView
      clients={clients}
      openNew={sp.new === "1"}
      stats={
        clients.length > 0 && (
          <StatStrip label="Client totals">
            <StatTile label="Clients" value={clients.length} note={`${billedCount} billed · ${clients.length - billedCount} not yet`} />
            <StatTile label="Owed to you" value={money(owed)} note={owing ? `across ${plural(owing, "client")}` : "Nobody owes you right now"} href="/invoices?sort=balance&dir=desc" />
            <StatTile label="Overdue" value={money(late)} tone={late ? "danger" : undefined} note={lateCount ? `${plural(lateCount, "client")} paying late` : "Nobody is late"} href="/invoices?view=overdue" />
            <StatTile label="Billed, all time" value={money(billed)} note={billedCount ? `${money(Math.round(billed / billedCount))} per client on average` : "No invoices yet"} />
          </StatStrip>
        )
      }
    />
  )
}

function ClientsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading clients" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="h-7 w-80 rounded-md" />
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
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex h-10 items-center gap-6 border-b px-4">
          <Skeleton className="h-3.5 w-4" />
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="ml-auto h-3.5 w-20" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  )
}
