import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { AlarmClockIcon, ArrowLeftIcon, ArrowRightIcon, DownloadIcon, SearchXIcon, WalletIcon } from "lucide-react"
import { cn } from "cn"

import { PageShell, PageTitle } from "@/components/app/page-shell"
import { EmptyState, GuestState } from "@/components/app/states"
import { FilterBar } from "@/components/payments/filter-bar"
import { PaymentsTable } from "@/components/payments/payments-table"
import { RecordPaymentButton } from "@/components/payments/record-button"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { todayIST } from "@/lib/billing/dates"
import { filtersQuery, parseFilters } from "@/lib/billing/filters"
import { MODE_SHORT, PAYMENT_MODES } from "@/lib/billing/modes"
import { formatINR } from "@/lib/billing/money"
import { listPayments, paymentSummary } from "@/lib/server/db/payments"
import { dbMessage } from "@/lib/server/db/util"
import { listClients } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Payments" }

/** Every payment received, filterable by date, client and mode, with totals and a CSV export. */
export default function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  return (
    <PageShell
      crumbs={[{ label: "Payments" }]}
      actions={
        <Suspense>
          <HeaderActions searchParams={searchParams} />
        </Suspense>
      }
    >
      <PageTitle title="Payments" description="Money received against your invoices. Each payment has its own receipt." />
      <Suspense fallback={<PaymentsSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </PageShell>
  )
}

async function HeaderActions({ searchParams }: { searchParams: PageProps<"/payments">["searchParams"] }) {
  const session = await getSession()
  if (!session) return null
  const filters = parseFilters(await searchParams, todayIST())
  return (
    <>
      <a href={`/api/payments/export?${filtersQuery(filters)}`} className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-3 text-[13px]")} download>
        <DownloadIcon /> <span className="hidden sm:inline">Export CSV</span>
      </a>
      <RecordPaymentButton />
    </>
  )
}

async function Body({ searchParams }: { searchParams: PageProps<"/payments">["searchParams"] }) {
  const session = await getSession()
  if (!session) return <GuestState icon={WalletIcon} title="Track what you've been paid" body="Log in to record payments against your invoices. Each one gets a numbered receipt you can share, and your balances update by themselves." />

  const sp = await searchParams
  const today = todayIST()
  const filters = parseFilters(sp, today)
  const defaults = parseFilters({}, today)
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined

  let data: [Awaited<ReturnType<typeof listPayments>>, Awaited<ReturnType<typeof paymentSummary>>, Awaited<ReturnType<typeof listClients>>]
  try {
    data = await Promise.all([listPayments(session.db, filters, { cursor }), paymentSummary(session.db, filters), listClients(session.db)])
  } catch (error) {
    return <EmptyState icon={AlarmClockIcon} title="Couldn't load your payments" body={dbMessage(error)} />
  }
  const [{ payments, next }, summary, clients] = data
  const filtered = filtersQuery(filters) !== filtersQuery(defaults)

  if (!payments.length && !cursor && !filtered) {
    const anyEver = await paymentSummary(session.db, { ...filters, from: null, to: null }).catch(() => ({ count: 0 }))
    if (!anyEver.count)
      return (
        <EmptyState icon={WalletIcon} title="No payments yet" body="Record your first payment from any sent invoice. The invoice's balance and status update straight away, and a receipt is made for you." action={{ label: "Go to invoices", href: "/invoices/sent" }} />
      )
  }

  const modes = PAYMENT_MODES.filter((m) => summary.byMode[m])
  return (
    <>
      <FilterBar filters={filters} defaults={defaults} clients={clients.map((c) => ({ id: c.id, name: c.name }))} searchPlaceholder="Search reference, invoice or client" />

      <section aria-label="Totals for these filters" className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-xl border bg-background px-4 py-3 text-[13px]">
        <span>
          <span className="text-muted-foreground">Total received </span>
          <span className="text-base font-semibold tabular-nums">{formatINR(summary.total)}</span>
        </span>
        <span className="text-muted-foreground tabular-nums">
          {summary.count} payment{summary.count === 1 ? "" : "s"}
        </span>
        {modes.length > 0 && (
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground tabular-nums sm:ml-auto">
            {modes.map((m) => (
              <span key={m}>
                {MODE_SHORT[m]} <span className="font-medium text-foreground">{formatINR(summary.byMode[m] ?? 0, { decimals: false })}</span>
              </span>
            ))}
          </span>
        )}
      </section>

      {payments.length ? (
        <>
          <PaymentsTable payments={payments} />
          {(next || cursor) && (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-center gap-2">
              {cursor && (
                <Link href={`/payments?${filtersQuery(filters)}`} className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-3 text-[13px]")}>
                  <ArrowLeftIcon /> Newest
                </Link>
              )}
              {next && (
                <Link href={`/payments?${filtersQuery(filters, { cursor: next })}`} className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-3 text-[13px]")}>
                  Older payments <ArrowRightIcon />
                </Link>
              )}
            </nav>
          )}
        </>
      ) : (
        <EmptyState icon={SearchXIcon} title="No payments match these filters" body="Try a wider date range, or clear the filters to see everything." action={{ label: "Clear filters", href: "/payments" }} />
      )}
    </>
  )
}

function PaymentsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading payments" className="grid gap-3">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}
