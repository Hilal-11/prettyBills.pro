import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  AlarmClockIcon,
  ArrowRightIcon,
  ChartColumnIcon,
  ChartLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  FilePlus2Icon,
  FileSpreadsheetIcon,
  FileTextIcon,
  HourglassIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { InvoiceList } from "@/components/app/invoice-list"
import { PageShell } from "@/components/app/page-shell"
import { StatStrip, StatTile } from "@/components/app/stat-strip"
import { EmptyState, MissingState } from "@/components/app/states"
import { ClientPanel } from "@/components/clients/client-panel"
import { ClientTabs, type ClientTab } from "@/components/clients/client-tabs"
import { QuotesGrid } from "@/components/quotes/quotes-grid"
import { clientQuoteCount, clientQuotes } from "@/lib/server/db/quotes"
import { AgeingChart, CashflowChart, DaysToPayChart, MethodsChart, Quiet } from "@/components/dashboard/board/lazy-charts"
import { InvoiceRows } from "@/components/dashboard/board/widgets"
import { ModeIcon } from "@/components/payments/mode-icon"
import { PaymentsTable } from "@/components/payments/payments-table"
import { RecordPaymentButton } from "@/components/payments/record-button"
import { Timeline } from "@/components/payments/timeline"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { clientProfile, taxTreatment } from "@/lib/billing/client-profile"
import { buildDashboard } from "@/lib/billing/dashboard"
import { dateIST, formatDate, nowMs, todayIST } from "@/lib/billing/dates"
import { STATEMENT_PERIODS, statementPeriod, type StatementPeriod } from "@/lib/billing/filters"
import { STATEMENT_KIND, type StatementRow } from "@/lib/billing/ledger"
import { MODE_LABEL } from "@/lib/billing/modes"
import { formatINR } from "@/lib/billing/money"
import type { InvoiceSummary, PaymentRow } from "@/lib/data/types"
import { formatMoney } from "@/lib/invoice/totals"
import { clientBalance, clientStatement, getClient } from "@/lib/server/db/clients"
import { clientCredits } from "@/lib/server/db/credit-notes"
import { listInvoices } from "@/lib/server/db/invoices"
import { listActivity, listPayments } from "@/lib/server/db/payments"
import { dbMessage } from "@/lib/server/db/util"
import { getSettings, listClients } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Client" }

const PERIOD_LABEL: Record<StatementPeriod, string> = { this_fy: "This FY", last_fy: "Last FY", this_month: "This month", last_month: "Last month", custom: "Custom" }
const TAB_IDS: ClientTab[] = ["overview", "invoices", "quotes", "payments", "statement", "activity"]

const money = (p: number) => formatMoney(p, { whole: true })
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`

/**
 * One client, edge to edge: a side panel with everything about them (contact,
 * GST, payment habits, history, actions) and, beside it, their numbers,
 * charts, invoices, payments, statement and timeline.
 */
export default function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<ClientSkeleton />}>
      <ClientBody params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function ClientBody({ params, searchParams }: { params: PageProps<"/clients/[id]">["params"]; searchParams: PageProps<"/clients/[id]">["searchParams"] }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(`/clients/${id}`)}`)
  const sp = await searchParams
  const tab: ClientTab = TAB_IDS.includes(sp.tab as ClientTab) ? (sp.tab as ClientTab) : "overview"
  const { db } = session

  let data: [
    Awaited<ReturnType<typeof getClient>>,
    Awaited<ReturnType<typeof clientBalance>>,
    Awaited<ReturnType<typeof listInvoices>>,
    Awaited<ReturnType<typeof listPayments>>,
    Awaited<ReturnType<typeof getSettings>> | null,
    Awaited<ReturnType<typeof listClients>>,
    Awaited<ReturnType<typeof clientCredits>>,
    number,
  ]
  try {
    // one round: nothing here depends on anything else
    data = await Promise.all([
      getClient(db, id),
      clientBalance(db, id),
      listInvoices(db, { clientId: id, limit: 500 }),
      listPayments(db, { clients: [id] }, { limit: 500 }),
      getSettings(db).catch(() => null),
      listClients(db).catch(() => []),
      clientCredits(db, id).catch(() => []),
      clientQuoteCount(db, id).catch(() => 0),
    ])
  } catch (error) {
    return (
      <PageShell crumbs={[{ label: "Clients", href: "/clients" }, { label: "Client" }]}>
        <EmptyState icon={AlarmClockIcon} title="Couldn't load this client" body={dbMessage(error)} />
      </PageShell>
    )
  }
  const [client, balance, { invoices }, { payments }, settings, all, credits, quoteCount] = data
  if (!client) {
    return (
      <PageShell crumbs={[{ label: "Clients", href: "/clients" }, { label: "Client" }]}>
        <MissingState title="We couldn't find that client" body="They may have been removed, or they belong to a different account." back={{ label: "Back to clients", href: "/clients" }} />
      </PageShell>
    )
  }

  const today = todayIST()
  const dash = invoices.map((i) => ({ ...i, paidOn: i.paidAt ? dateIST(i.paidAt) : null }))
  const profile = clientProfile(dash, payments)
  const charts = buildDashboard(
    dash,
    payments.map((p) => ({ amount: p.amount, paidOn: p.paidOn, mode: p.mode })),
    today
  )
  const business = settings?.business
  const tax = taxTreatment({ gstin: client.gstin, stateCode: client.address.stateCode, country: client.address.country }, business?.gstin?.slice(0, 2) || business?.address?.stateCode)
  const at = all.findIndex((c) => c.id === id)
  const prev = at > 0 ? all[at - 1] : null
  const next = at >= 0 && at < all.length - 1 ? all[at + 1] : null
  const base = `/clients/${encodeURIComponent(id)}`

  return (
    <PageShell
      crumbs={[{ label: "Clients", href: "/clients" }, { label: client.name }]}
      bleed
      actions={
        <>
          {all.length > 1 && (
            <span className="mr-1 hidden items-center gap-0.5 sm:flex">
              <NavArrow href={prev ? `/clients/${encodeURIComponent(prev.id)}` : null} label={prev ? `Previous: ${prev.name}` : "First client"} dir="up" />
              <NavArrow href={next ? `/clients/${encodeURIComponent(next.id)}` : null} label={next ? `Next: ${next.name}` : "Last client"} dir="down" />
              <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                {at + 1}/{all.length}
              </span>
            </span>
          )}
          <Link href={`/create?client=${encodeURIComponent(id)}`} className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-3 text-[13px]")}>
            <FilePlus2Icon /> <span className="hidden sm:inline">New invoice</span>
          </Link>
          <RecordPaymentButton clientId={id} />
        </>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto lg:flex lg:overflow-hidden">
        <aside aria-label="Client details" className="border-b lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <ClientPanel client={client} balance={balance} profile={profile} tax={tax} invoices={balance.invoices} credit={credits.reduce((s, n) => s + n.unapplied, 0)} />
        </aside>
        <div className="min-w-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto">
          <ClientTabs
            base={base}
            active={tab}
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "invoices", label: "Invoices", count: invoices.length },
              { id: "quotes", label: "Quotes", count: quoteCount },
              { id: "payments", label: "Payments", count: payments.length },
              { id: "statement", label: "Statement" },
              { id: "activity", label: "Activity" },
            ]}
          />
          <Suspense
            key={tab}
            fallback={
              <div className="p-5">
                <Skeleton className="h-72 rounded-xl" />
              </div>
            }
          >
            {tab === "overview" ? (
              <Overview id={id} balance={balance} charts={charts} invoices={invoices} payments={payments} lastPayment={profile.lastPayment} />
            ) : (
              <div className="p-4 sm:p-5">
                {tab === "invoices" && <InvoicesTab id={id} />}
                {tab === "quotes" && <QuotesTab id={id} />}
                {tab === "payments" && <PaymentsTab id={id} />}
                {tab === "statement" && <StatementTab id={id} sp={sp} />}
                {tab === "activity" && <ActivityTab id={id} />}
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </PageShell>
  )
}

function NavArrow({ href, label, dir }: { href: string | null; label: string; dir: "up" | "down" }) {
  const Icon = dir === "up" ? ChevronUpIcon : ChevronDownIcon
  const cls = cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "size-7")
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cls}>
      <Icon />
    </Link>
  ) : (
    <span aria-label={label} title={label} className={cn(cls, "pointer-events-none opacity-40")}>
      <Icon />
    </span>
  )
}

/* ------------------------------- overview ------------------------------- */

function Overview({
  id,
  balance,
  charts,
  invoices,
  payments,
  lastPayment,
}: {
  id: string
  balance: Awaited<ReturnType<typeof clientBalance>>
  charts: ReturnType<typeof buildDashboard>
  invoices: InvoiceSummary[]
  payments: PaymentRow[]
  lastPayment: string | null
}) {
  const overdue = invoices.filter((i) => i.bucket === "overdue").sort((a, b) => (b.daysPastDue ?? 0) - (a.daysPastDue ?? 0))
  const open = invoices.filter((i) => i.bucket === "sent" && i.balanceDue > 0).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
  const recent = [...invoices].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)
  const latestPayments = [...payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  const base = `/clients/${encodeURIComponent(id)}`
  return (
    <>
      <StatStrip label="Balance" className="lg:grid-cols-5">
        <StatTile label="Total billed" value={money(balance.billed)} full={formatINR(balance.billed)} note={plural(balance.invoices, "invoice")} />
        <StatTile label="Received" value={money(balance.received)} full={formatINR(balance.received)} tone={balance.received ? "good" : undefined} note={lastPayment ? `Last paid ${formatDate(lastPayment)}` : "No payments yet"} href={`${base}?tab=payments`} />
        <StatTile label="TDS deducted" value={money(balance.tds)} full={formatINR(balance.tds)} note={balance.tds ? "Settled by the client's TDS" : "None deducted"} href={balance.tds ? "/payments?tab=tds" : undefined} />
        <StatTile label="Outstanding" value={money(balance.outstanding)} full={formatINR(balance.outstanding)} note={balance.outstanding ? "Still to collect" : "All settled"} href={`${base}?tab=statement`} />
        <StatTile label="Overdue" value={money(balance.overdue)} full={formatINR(balance.overdue)} tone={balance.overdue ? "danger" : undefined} note={balance.overdueInvoices ? `${plural(balance.overdueInvoices, "invoice")} past due` : "Nothing late"} />
      </StatStrip>
      <div className="-mr-px grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
        <OverviewCard title="Billed vs received" icon={ChartLineIcon} className="xl:col-span-2">
          <CashflowChart data={charts.monthly} tall />
        </OverviewCard>
        <OverviewCard title="Unpaid invoices" icon={WalletIcon} href={`${base}?tab=invoices`} link="All invoices">
          {overdue.length + open.length ? (
            <>
              {overdue.length > 0 && <InvoiceRows invoices={overdue.slice(0, 6)} kind="overdue" />}
              {open.length > 0 && <InvoiceRows invoices={open.slice(0, 6)} kind="upcoming" />}
            </>
          ) : (
            <Quiet>Nothing unpaid. Every invoice to this client is settled.</Quiet>
          )}
        </OverviewCard>
        <OverviewCard title="Owed, by age" icon={ChartColumnIcon}>
          <AgeingChart ageing={charts.ageing} />
        </OverviewCard>
        <OverviewCard title="Recent payments" icon={ReceiptTextIcon} href={`${base}?tab=payments`} link="All payments">
          {latestPayments.length ? (
            <ul className="divide-y">
              {latestPayments.map((p) => (
                <li key={p.id}>
                  <Link href={p.receiptId ? `/receipts/${p.receiptId}` : `/invoices/${p.invoiceId}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/40">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <ModeIcon mode={p.mode} className="size-3.5" />
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">
                        {MODE_LABEL[p.mode]}
                        {p.reference ? <span className="font-normal text-muted-foreground"> · {p.reference}</span> : null}
                      </span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        {formatDate(p.paidOn)} · {p.invoiceNumber}
                        {p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatINR(p.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Quiet>No payments recorded for this client yet.</Quiet>
          )}
        </OverviewCard>
        <OverviewCard title="How they pay" icon={WalletIcon}>
          <MethodsChart methods={charts.methods} />
        </OverviewCard>
        <OverviewCard title="Days to get paid" icon={HourglassIcon}>
          <DaysToPayChart data={charts.daysToPay} />
        </OverviewCard>
        <OverviewCard title="Recent invoices" icon={FileTextIcon} href={`${base}?tab=invoices`} link="All invoices">
          {recent.length ? <InvoiceRows invoices={recent} kind="recent" /> : <Quiet>No invoices for this client yet.</Quiet>}
        </OverviewCard>
      </div>
    </>
  )
}

function OverviewCard({ title, icon: Icon, href, link, className, children }: { title: string; icon: LucideIcon; href?: string; link?: string; className?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn("flex min-h-56 min-w-0 flex-col border-r border-b bg-background", className)}>
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
        <Icon className="size-3.5 text-muted-foreground" />
        <h2 className="truncate text-[13px] font-semibold">{title}</h2>
        {href && (
          <Link href={href} scroll={false} className="group/link ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            {link} <ArrowRightIcon className="size-3 transition-transform group-hover/link:translate-x-0.5" />
          </Link>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

/* --------------------------------- tabs --------------------------------- */

async function InvoicesTab({ id }: { id: string }) {
  const session = (await getSession())!
  const { invoices } = await listInvoices(session.db, { clientId: id, limit: 200 })
  if (!invoices.length) return <EmptyState icon={FileTextIcon} title="No invoices for this client yet" body="Invoices you make for them show up here, with what each one still owes." action={{ label: "Create an invoice", href: `/create?client=${encodeURIComponent(id)}` }} />
  return <InvoiceList invoices={invoices} view="all" today={todayIST()} />
}

async function QuotesTab({ id }: { id: string }) {
  const session = (await getSession())!
  const quotes = await clientQuotes(session.db, id)
  if (!quotes.length) return <EmptyState icon={ScrollTextIcon} title="No quotes for this client yet" body="Quotes and proforma invoices you send them show up here, with what they said." action={{ label: "New quote", href: `/quotes/new?kind=quote&client=${encodeURIComponent(id)}` }} />
  return (
    <div className="-m-4 flex min-h-96 flex-col sm:-m-5">
      <QuotesGrid quotes={quotes} />
    </div>
  )
}

async function PaymentsTab({ id }: { id: string }) {
  const session = (await getSession())!
  const { payments } = await listPayments(session.db, { clients: [id] }, { limit: 200 })
  if (!payments.length) return <EmptyState icon={ReceiptTextIcon} title="No payments yet" body="Payments you record on this client's invoices show up here, each with its receipt." />
  return <PaymentsTable payments={payments} showClient={false} />
}

async function StatementTab({ id, sp }: { id: string; sp: Record<string, string | string[] | undefined> }) {
  const session = (await getSession())!
  const today = todayIST()
  const { period, from, to } = statementPeriod(sp, today)
  const s = await clientStatement(session.db, id, from, to)
  const q = new URLSearchParams(period === "custom" ? { period, from, to } : { period })
  const base = `/clients/${encodeURIComponent(id)}?tab=statement`

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ul className="inline-flex w-fit gap-0.5 rounded-lg border bg-muted/50 p-0.5" aria-label="Statement period">
          {STATEMENT_PERIODS.filter((p) => p !== "custom").map((p) => (
            <li key={p}>
              <Link href={`${base}&period=${p}`} scroll={false} aria-current={period === p ? "true" : undefined} className={cn("inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap", period === p ? "border bg-background shadow-xs" : "text-foreground/60 hover:text-foreground")}>
                {PERIOD_LABEL[p]}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <a href={`/api/clients/${encodeURIComponent(id)}/statement?${q}&format=pdf`} download className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-3 text-[13px]")}>
            <DownloadIcon /> Download PDF
          </a>
          <a href={`/api/clients/${encodeURIComponent(id)}/statement?${q}&format=csv`} download className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-3 text-[13px]")}>
            <FileSpreadsheetIcon /> Export CSV
          </a>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatDate(from)} – {formatDate(to)}
      </p>

      <dl className={cn("grid grid-cols-2 overflow-hidden rounded-xl border bg-background text-[13px] tabular-nums", s.tds ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
        {(
          [
            ["Opening balance", s.opening],
            ["Invoiced", s.invoiced],
            ["Received", s.received],
            ...(s.tds ? ([["TDS deducted", s.tds]] as const) : []),
            ["Closing balance", s.closing],
          ] as const
        ).map(([k, v], i, all) => (
          <div key={k} className={cn("border-t px-4 py-3 sm:border-t-0", i > 0 && "sm:border-l", i % 2 === 1 && "border-l", i < 2 && "border-t-0", i === all.length - 1 && "bg-muted/40")}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 text-base font-semibold">{formatINR(v)}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[720px] text-[13px] tabular-nums">
          <caption className="sr-only">Statement of account</caption>
          <thead className="border-b bg-muted/40 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Number</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Debit</th>
              <th className="px-4 py-2 text-right font-medium">Credit</th>
              <th className="px-4 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="bg-muted/20">
              <td className="px-4 py-2">{formatDate(from)}</td>
              <td colSpan={5} className="px-4 py-2 font-medium">
                Opening balance
              </td>
              <td className="px-4 py-2 text-right font-semibold">{formatINR(s.opening)}</td>
            </tr>
            {s.rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} className="hover:bg-muted/30">
                <td className="px-4 py-2">{formatDate(r.date)}</td>
                <td className="px-4 py-2">{STATEMENT_KIND[r.kind]}</td>
                <td className="px-4 py-2">
                  <Link href={rowHref(r)} className="font-medium text-brand hover:underline dark:text-[#6da2ff]">
                    {r.number}
                  </Link>
                </td>
                <td className="max-w-72 truncate px-4 py-2 text-muted-foreground">{r.description}</td>
                <td className="px-4 py-2 text-right">{r.debit ? formatINR(r.debit) : ""}</td>
                <td className="px-4 py-2 text-right text-emerald-700 dark:text-emerald-400">{r.credit ? formatINR(r.credit) : ""}</td>
                <td className="px-4 py-2 text-right font-medium">{formatINR(r.balance)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-foreground/20 bg-muted/20">
              <td className="px-4 py-2">{formatDate(to)}</td>
              <td colSpan={5} className="px-4 py-2 font-semibold">
                Closing balance
              </td>
              <td className="px-4 py-2 text-right font-semibold">{formatINR(s.closing)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {!s.rows.length && <p className="text-center text-[13px] text-muted-foreground">No invoices or payments in this period.</p>}
    </div>
  )
}

async function ActivityTab({ id }: { id: string }) {
  const session = (await getSession())!
  const items = await listActivity(session.db, { clientId: id }, session.userId, 80)
  return (
    <section className="overflow-hidden rounded-xl border bg-background">
      <Timeline items={items} now={nowMs()} hide={["receipt.created"]} linkInvoices empty="Nothing has happened with this client yet." />
    </section>
  )
}

function ClientSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Loading client">
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[340px] shrink-0 content-start gap-3 border-r p-5 lg:grid">
          <Skeleton className="size-12 rounded-xl" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
          <div className="mt-2 flex gap-1.5">
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="flex-1">
          <div className="h-11 border-b" />
          <div className="grid grid-cols-2 border-b lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid gap-2 border-r px-4 py-3 last:border-r-0">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="m-5 h-72 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/** Where a statement row's number links to. */
function rowHref(r: StatementRow) {
  switch (r.kind) {
    case "invoice":
      return `/invoices/${r.id}`
    case "credit_note":
      return `/credit-notes/${r.id}`
    case "refund":
      return `/credit-notes/${r.creditNoteId}`
    default:
      return r.receiptId ? `/receipts/${r.receiptId}` : `/invoices/${r.invoiceId}`
  }
}
