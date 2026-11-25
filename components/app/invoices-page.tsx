import { Suspense } from "react"
import Link from "next/link"
import { AlarmClockIcon, CircleCheckBigIcon, FilePenLineIcon, FilePlus2Icon, FileTextIcon, SendIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney } from "@/lib/invoice/totals"
import { getOverview, listInvoices } from "@/lib/server/db/invoices"
import { dbMessage, today } from "@/lib/server/db/util"
import { getSession } from "@/lib/server/session"

import { InvoiceList, type ListView } from "./invoice-list"
import { ListSearch, LoadMore, ViewTabs } from "./list-controls"
import { PageShell, PageTitle } from "./page-shell"
import { EmptyState, GuestState } from "./states"

type ViewCopy = { title: string; crumb: string; description: string; empty: { icon: LucideIcon; title: string; body: string; cta?: boolean } }

export const VIEWS: Record<ListView, ViewCopy> = {
  all: {
    title: "Invoices",
    crumb: "All",
    description: "Every invoice you've made, newest first.",
    empty: { icon: FileTextIcon, title: "No invoices yet", body: "Your invoices show up here as soon as you start one. Drafts save themselves as you type.", cta: true },
  },
  draft: {
    title: "Drafts",
    crumb: "Drafts",
    description: "Started but not sent. Finish them and send, or tidy up the ones you don't need.",
    empty: { icon: FilePenLineIcon, title: "No drafts", body: "An invoice you start but don't send waits here until you're ready.", cta: true },
  },
  sent: {
    title: "Awaiting payment",
    crumb: "Sent",
    description: "Sent and not yet paid, soonest due first. Mark them paid as money comes in.",
    empty: { icon: SendIcon, title: "Nothing awaiting payment", body: "Invoices you send land here until they're paid." },
  },
  overdue: {
    title: "Overdue",
    crumb: "Overdue",
    description: "Past their due date and still unpaid, oldest first. A reminder is one tap away.",
    empty: { icon: CircleCheckBigIcon, title: "Nothing overdue", body: "Every sent invoice is either paid or not yet due. Nice." },
  },
  paid: {
    title: "Paid",
    crumb: "Paid",
    description: "Paid in full, most recent first.",
    empty: { icon: CircleCheckBigIcon, title: "No paid invoices yet", body: "Mark an invoice as paid (or record the full amount in it) and it moves here." },
  },
}

const PAGE = 50

/** Shared page for /invoices and each of its views. */
export function InvoicesPage({ view, searchParams }: { view: ListView; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const copy = VIEWS[view]
  return (
    <PageShell
      crumbs={view === "all" ? [{ label: "Invoices" }] : [{ label: "Invoices", href: "/invoices" }, { label: copy.crumb }]}
      actions={
        <Link href="/create" className={cn(buttonVariants(), "h-8 gap-1.5 px-3 text-[13px]")}>
          <FilePlus2Icon /> <span className="hidden sm:inline">New invoice</span>
        </Link>
      }
    >
      <PageTitle title={copy.title} description={copy.description} />
      <Suspense fallback={<ListSkeleton />}>
        <Body view={view} searchParams={searchParams} />
      </Suspense>
    </PageShell>
  )
}

async function Body({ view, searchParams }: { view: ListView; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession()
  if (!session) {
    return <GuestState icon={VIEWS[view].empty.icon} title="Your invoices live here" body="Log in and every invoice you make is saved, sorted into drafts, sent, overdue and paid, and searchable." />
  }
  const sp = await searchParams
  const q = typeof sp.q === "string" ? sp.q : ""
  const page = Math.max(1, Math.min(20, Number(sp.page) || 1))

  let data: Awaited<ReturnType<typeof listInvoices>>
  let overview: Awaited<ReturnType<typeof getOverview>>
  try {
    ;[data, overview] = await Promise.all([listInvoices(session.db, { bucket: view === "all" ? "all" : view, q, limit: PAGE * page }), getOverview(session.db)])
  } catch (error) {
    return <EmptyState icon={AlarmClockIcon} title="Couldn't load your invoices" body={dbMessage(error)} />
  }

  const tabs = [
    { href: "/invoices", label: "All", count: overview.all },
    { href: "/invoices/drafts", label: "Drafts", count: overview.drafts },
    { href: "/invoices/sent", label: "Sent", count: overview.sent },
    { href: "/invoices/overdue", label: "Overdue", count: overview.overdue, tone: "danger" as const },
    { href: "/invoices/paid", label: "Paid", count: overview.paid },
  ]
  const summary =
    view === "overdue" && overview.overdue > 0
      ? `${formatMoney(overview.overdueAmount, { whole: true })} overdue across ${overview.overdue} invoice${overview.overdue === 1 ? "" : "s"}`
      : view === "sent" && overview.sent > 0
        ? `${formatMoney(overview.outstanding - overview.overdueAmount, { whole: true })} on its way from ${overview.sent} invoice${overview.sent === 1 ? "" : "s"}`
        : view === "paid" && overview.collectedMonth > 0
          ? `${formatMoney(overview.collectedMonth, { whole: true })} collected this month`
          : view === "draft" && overview.draftsReady > 0
            ? `${overview.draftsReady} draft${overview.draftsReady === 1 ? " is" : "s are"} ready to send`
            : null

  const empty = VIEWS[view].empty
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ViewTabs label="Invoice views" tabs={tabs} />
        <ListSearch placeholder="Search by number or client" />
      </div>
      {summary && (
        <p className={cn("mb-3 text-[13px]", view === "overdue" ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{summary}</p>
      )}
      {data.invoices.length ? (
        <>
          <InvoiceList invoices={data.invoices} view={view} today={today()} />
          {data.hasMore && <LoadMore />}
        </>
      ) : q ? (
        <EmptyState icon={empty.icon} title={`Nothing matches “${q}”`} body="Try part of the invoice number, or the client's name." />
      ) : (
        <EmptyState icon={empty.icon} title={empty.title} body={empty.body} action={empty.cta ? { label: "Create an invoice", href: "/create" } : undefined} />
      )}
    </>
  )
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading invoices">
      <div className="mb-4 flex justify-between gap-3">
        <Skeleton className="h-8 w-80 rounded-lg" />
        <Skeleton className="hidden h-8 w-72 rounded-lg md:block" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="hidden h-3.5 w-20 md:block" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
