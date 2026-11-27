import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { AlarmClockIcon, ArrowDownWideNarrowIcon, ReceiptTextIcon, SearchXIcon } from "lucide-react"
import { cn } from "cn"

import { LoadMore } from "@/components/app/list-controls"
import { PageShell, PageTitle } from "@/components/app/page-shell"
import { EmptyState, GuestState } from "@/components/app/states"
import { FilterBar } from "@/components/payments/filter-bar"
import { ReceiptsTable } from "@/components/receipts/receipts-table"
import { Skeleton } from "@/components/ui/skeleton"
import { todayIST } from "@/lib/billing/dates"
import { filtersQuery, parseFilters } from "@/lib/billing/filters"
import { hasAnyReceipt, listReceipts } from "@/lib/server/db/payments"
import { dbMessage } from "@/lib/server/db/util"
import { listClients } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Receipts" }

const PAGE = 50

/** Every receipt, newest first. Receipts are made by recording payments; there's no "new receipt". */
export default function ReceiptsPage({ searchParams }: PageProps<"/receipts">) {
  return (
    <PageShell crumbs={[{ label: "Receipts" }]}>
      <PageTitle title="Receipts" description="One numbered receipt for every payment, in your invoice's design. Share, email or download any of them." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </PageShell>
  )
}

async function Body({ searchParams }: { searchParams: PageProps<"/receipts">["searchParams"] }) {
  const session = await getSession()
  if (!session) return <GuestState icon={ReceiptTextIcon} title="Receipts for every payment" body="Log in and record a payment on an invoice: a numbered receipt is made for you, ready to share on WhatsApp or by email." />

  const sp = await searchParams
  const today = todayIST()
  const filters = parseFilters(sp, today, { preset: "last_30" })
  const defaults = parseFilters({}, today, { preset: "last_30" })
  const sort = sp.sort === "amount" ? "amount" : "date"
  const page = Math.max(1, Math.min(40, Number(sp.page) || 1))

  let data: [Awaited<ReturnType<typeof listReceipts>>, Awaited<ReturnType<typeof listClients>>]
  try {
    data = await Promise.all([listReceipts(session.db, filters, { sort, limit: PAGE * page }), listClients(session.db)])
  } catch (error) {
    return <EmptyState icon={AlarmClockIcon} title="Couldn't load your receipts" body={dbMessage(error)} />
  }
  const [{ receipts, hasMore }, clients] = data

  if (!receipts.length && !(await hasAnyReceipt(session.db).catch(() => true))) {
    return <EmptyState icon={ReceiptTextIcon} title="No receipts yet" body="Receipts are created automatically when you record a payment on an invoice." action={{ label: "Go to invoices", href: "/invoices/sent" }} />
  }

  const sortHref = (s: "date" | "amount") => `/receipts?${filtersQuery(filters, s === "amount" ? { sort: "amount" } : {})}`
  return (
    <>
      <FilterBar filters={filters} defaults={defaults} clients={clients.map((c) => ({ id: c.id, name: c.name }))} searchPlaceholder="Search receipt, invoice, client or reference" statusFilter />
      <div className="mb-2 flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <ArrowDownWideNarrowIcon className="size-3.5" /> Sort:
        {(["date", "amount"] as const).map((s) => (
          <Link key={s} href={sortHref(s)} aria-current={sort === s ? "true" : undefined} className={cn("rounded px-1.5 py-0.5 capitalize hover:text-foreground", sort === s && "bg-muted font-medium text-foreground")}>
            {s === "date" ? "Newest" : "Amount"}
          </Link>
        ))}
      </div>
      {receipts.length ? (
        <>
          <ReceiptsTable receipts={receipts} />
          {hasMore && <LoadMore />}
        </>
      ) : (
        <EmptyState icon={SearchXIcon} title="No receipts match these filters" body="Try a wider date range or another status." action={{ label: "Clear filters", href: "/receipts" }} />
      )}
    </>
  )
}
