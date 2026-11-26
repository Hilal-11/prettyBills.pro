import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlarmClockIcon, CircleCheckBigIcon, DownloadIcon, FilePlus2Icon, FileSpreadsheetIcon, FileTextIcon, ReceiptTextIcon, WalletIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { InvoiceList } from "@/components/app/invoice-list"
import { PageShell } from "@/components/app/page-shell"
import { EmptyState, MissingState } from "@/components/app/states"
import { PaymentsTable } from "@/components/payments/payments-table"
import { RecordPaymentButton } from "@/components/payments/record-button"
import { Timeline } from "@/components/payments/timeline"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, nowMs, todayIST } from "@/lib/billing/dates"
import { STATEMENT_PERIODS, statementPeriod, type StatementPeriod } from "@/lib/billing/filters"
import { formatINR } from "@/lib/billing/money"
import { stateLabel } from "@/lib/invoice/config"
import { clientBalance, clientStatement, getClient } from "@/lib/server/db/clients"
import { listInvoices } from "@/lib/server/db/invoices"
import { listActivity, listPayments } from "@/lib/server/db/payments"
import { dbMessage } from "@/lib/server/db/util"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Client" }

const TABS = [
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "statement", label: "Statement" },
  { id: "activity", label: "Activity" },
] as const
type Tab = (typeof TABS)[number]["id"]

const PERIOD_LABEL: Record<StatementPeriod, string> = { this_fy: "This FY", last_fy: "Last FY", this_month: "This month", last_month: "Last month", custom: "Custom" }

/** One client: what they've been billed, paid and still owe, with invoices, payments, a statement and a timeline. */
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
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "invoices"

  let client: Awaited<ReturnType<typeof getClient>>
  let balance: Awaited<ReturnType<typeof clientBalance>>
  try {
    ;[client, balance] = await Promise.all([getClient(session.db, id), clientBalance(session.db, id)])
  } catch (error) {
    return (
      <PageShell crumbs={[{ label: "Clients", href: "/clients" }, { label: "Client" }]}>
        <EmptyState icon={AlarmClockIcon} title="Couldn't load this client" body={dbMessage(error)} />
      </PageShell>
    )
  }
  if (!client) {
    return (
      <PageShell crumbs={[{ label: "Clients", href: "/clients" }, { label: "Client" }]}>
        <MissingState title="We couldn't find that client" body="They may have been removed, or they belong to a different account." back={{ label: "Back to clients", href: "/clients" }} />
      </PageShell>
    )
  }

  const place = [client.address.city, client.address.stateCode && stateLabel(client.address.stateCode).replace(/ \(\d+\)$/, "")].filter(Boolean).join(", ")
  const href = (t: Tab) => `/clients/${encodeURIComponent(id)}${t === "invoices" ? "" : `?tab=${t}`}`

  return (
    <PageShell
      crumbs={[{ label: "Clients", href: "/clients" }, { label: client.name }]}
      actions={
        <>
          <Link href={`/create?client=${encodeURIComponent(id)}`} className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-3 text-[13px]")}>
            <FilePlus2Icon /> <span className="hidden sm:inline">New invoice</span>
          </Link>
          <RecordPaymentButton clientId={id} />
        </>
      }
    >
      <div className="mb-6 grid gap-1">
        <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{client.name}</h1>
        <p className="text-[13px] text-muted-foreground">{[client.gstin && `GSTIN ${client.gstin}`, client.email, client.phone, place].filter(Boolean).join(" · ") || "No contact details yet"}</p>
      </div>

      <section aria-label="Balance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={FileTextIcon} label="Total billed" value={formatINR(balance.billed, { decimals: false })} full={formatINR(balance.billed)} note={`${balance.invoices} invoice${balance.invoices === 1 ? "" : "s"}`} />
        <Card icon={CircleCheckBigIcon} label="Received" value={formatINR(balance.received, { decimals: false })} full={formatINR(balance.received)} note="Recorded payments" tone="good" />
        <Card icon={WalletIcon} label="Outstanding" value={formatINR(balance.outstanding, { decimals: false })} full={formatINR(balance.outstanding)} note={balance.outstanding ? "Still to collect" : "All settled"} />
        <Card
          icon={AlarmClockIcon}
          label="Overdue"
          value={formatINR(balance.overdue, { decimals: false })}
          full={formatINR(balance.overdue)}
          note={balance.overdueInvoices ? `${balance.overdueInvoices} invoice${balance.overdueInvoices === 1 ? "" : "s"} past due` : "Nothing late"}
          tone={balance.overdue > 0 ? "danger" : undefined}
        />
      </section>

      <nav aria-label="Client sections" className="mt-6 mb-4 -mx-1 overflow-x-auto px-1">
        <ul className="inline-flex gap-0.5 rounded-lg border bg-muted/50 p-0.5">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link href={href(t.id)} aria-current={tab === t.id ? "page" : undefined} scroll={false} className={cn("inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors", tab === t.id ? "border bg-background text-foreground shadow-xs" : "text-foreground/60 hover:text-foreground")}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Suspense key={tab} fallback={<Skeleton className="h-72 rounded-xl" />}>
        {tab === "invoices" && <InvoicesTab id={id} />}
        {tab === "payments" && <PaymentsTab id={id} />}
        {tab === "statement" && <StatementTab id={id} sp={sp} />}
        {tab === "activity" && <ActivityTab id={id} />}
      </Suspense>
    </PageShell>
  )
}

async function InvoicesTab({ id }: { id: string }) {
  const session = (await getSession())!
  const { invoices } = await listInvoices(session.db, { clientId: id, limit: 200 })
  if (!invoices.length) return <EmptyState icon={FileTextIcon} title="No invoices for this client yet" body="Invoices you make for them show up here, with what each one still owes." action={{ label: "Create an invoice", href: `/create?client=${encodeURIComponent(id)}` }} />
  return <InvoiceList invoices={invoices} view="all" today={todayIST()} />
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

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border bg-background text-[13px] tabular-nums sm:grid-cols-4">
        {(
          [
            ["Opening", s.opening],
            ["Invoiced", s.invoiced],
            ["Received", s.received],
            ["Closing", s.closing],
          ] as const
        ).map(([k, v], i) => (
          <div key={k} className={cn("px-4 py-3", i > 0 && "sm:border-l", i % 2 === 1 && "border-l", i >= 2 && "border-t sm:border-t-0", i === 3 && "bg-muted/40")}>
            <dt className="text-muted-foreground">{k} balance</dt>
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
                <td className="px-4 py-2">{r.kind === "invoice" ? "Invoice" : "Payment"}</td>
                <td className="px-4 py-2">
                  <Link href={r.kind === "invoice" ? `/invoices/${r.id}` : r.receiptId ? `/receipts/${r.receiptId}` : `/invoices/${r.invoiceId}`} className="font-medium text-brand hover:underline dark:text-[#6da2ff]">
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

function Card({ icon: Icon, label, value, full, note, tone }: { icon: LucideIcon; label: string; value: string; full: string; note: string; tone?: "danger" | "good" }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className={cn("grid size-7 place-items-center rounded-lg", tone === "danger" ? "bg-red-500/10 text-red-600 dark:text-red-400" : tone === "good" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-brand/10 text-brand dark:text-[#6da2ff]")}>
          <Icon className="size-3.5" />
        </span>
      </span>
      <span title={full} className={cn("mt-2 block text-xl font-semibold tracking-[-0.02em] tabular-nums sm:text-2xl", tone === "danger" && "text-red-600 dark:text-red-400")}>
        {value}
      </span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">{note}</span>
    </div>
  )
}

function ClientSkeleton() {
  return (
    <div className="grid gap-6 p-6" aria-busy="true" aria-label="Loading client">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}
