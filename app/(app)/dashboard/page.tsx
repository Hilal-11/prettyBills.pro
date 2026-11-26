import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  AlarmClockIcon,
  ArrowRightIcon,
  BanIcon,
  CheckCircle2Icon,
  CircleCheckBigIcon,
  DownloadIcon,
  EyeIcon,
  FilePlus2Icon,
  HourglassIcon,
  TimerIcon,
  Trash2Icon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  SendIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { OpenSettings, RefreshButton } from "@/components/app/client-buttons"
import { PageShell, PageTitle } from "@/components/app/page-shell"
import { EmptyState, GuestState } from "@/components/app/states"
import { StatusBadge } from "@/components/app/status"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { ClientWithStats, InvoiceSummary, Overview } from "@/lib/data/types"
import { formatDate } from "@/lib/invoice/format"
import { formatMoney } from "@/lib/invoice/totals"
import { formatINR } from "@/lib/billing/money"
import { isMode, MODE_LABEL } from "@/lib/billing/modes"
import { getOverview, listInvoices, listRecentActivity, type Activity } from "@/lib/server/db/invoices"
import { listRecentPaymentActivity } from "@/lib/server/db/payments"
import { dbMessage } from "@/lib/server/db/util"
import { getSettings, listClientsWithStats } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Dashboard" }

const money = (n: number) => formatMoney(n, { whole: true })

/** Overview of everything the user has made: what's owed, what's late, what happened. */
export default function DashboardPage() {
  return (
    <PageShell crumbs={[{ label: "Dashboard" }]}>
      <PageTitle title="Dashboard" description="Collections, outstanding invoices and client activity.">
        <RefreshButton />
        <Link href="/create" className={cn(buttonVariants(), "h-8 gap-1.5 px-3 text-[13px]")}>
          <FilePlus2Icon /> Create invoice
        </Link>
      </PageTitle>
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewBody />
      </Suspense>
    </PageShell>
  )
}

async function OverviewBody() {
  const session = await getSession()
  if (!session) {
    return (
      <GuestState
        icon={LayoutDashboardIcon}
        title="Your business at a glance"
        body="Log in to see what you're owed, what's overdue and what your clients have opened, all in one place. Making invoices works without an account."
      />
    )
  }
  const { db } = session

  let data: [Overview, { invoices: InvoiceSummary[] }, { invoices: InvoiceSummary[] }, Activity[], ClientWithStats[], Awaited<ReturnType<typeof getSettings>>, Awaited<ReturnType<typeof listRecentPaymentActivity>>]
  try {
    data = await Promise.all([
      getOverview(db),
      listInvoices(db, { bucket: "overdue", limit: 5 }),
      listInvoices(db, { bucket: "sent", limit: 5 }),
      listRecentActivity(db, 8),
      listClientsWithStats(db),
      getSettings(db),
      // payments arrive with the payments migration; until then the feed shows invoice events only
      listRecentPaymentActivity(db, 8).catch(() => []),
    ])
  } catch (error) {
    return <EmptyState icon={AlarmClockIcon} title="Couldn't load your dashboard" body={dbMessage(error)} />
  }
  const [o, overdue, sent, invoiceActivity, clients, settings, paymentActivity] = data
  const activity: Activity[] = [
    ...invoiceActivity.filter((a) => a.type !== "paid"),
    ...paymentActivity.map((p) => ({
      type: (p.action === "payment.deleted" ? "payment_deleted" : "payment") as Activity["type"],
      at: p.created_at,
      invoiceId: p.invoice_id ?? "",
      number: String(p.data.invoice_number ?? ""),
      clientName: "",
      detail:
        p.action === "payment.deleted"
          ? `payment of ${formatINR(Number(p.data.amount_paise ?? 0))} deleted`
          : `${formatINR(Number(p.data.amount_paise ?? 0))} received${isMode(p.data.mode) ? ` via ${MODE_LABEL[p.data.mode]}` : ""}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)
  const change = o.collectedLastMonth > 0 ? Math.round(((o.collectedMonth - o.collectedLastMonth) / o.collectedLastMonth) * 100) : null

  if (o.all === 0) return <GettingStarted hasBusiness={!!settings.business?.name} hasClient={clients.length > 0} />

  // late first, then what's due within a week
  const dueSoon = sent.invoices.filter((i) => i.daysPastDue != null && i.daysPastDue >= -7)
  const attention = [...overdue.invoices, ...dueSoon].slice(0, 6)
  const topClients = clients
    .filter((c) => c.invoices > 0)
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 5)

  return (
    <div className="grid gap-6">
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi href="/invoices/sent" icon={WalletIcon} label="Outstanding" value={formatINR(o.outstanding, { decimals: false })} full={formatINR(o.outstanding)} note={`${o.outstandingCount} invoice${o.outstandingCount === 1 ? "" : "s"}`} />
        <Kpi
          href="/invoices/overdue"
          icon={AlarmClockIcon}
          label="Overdue"
          value={formatINR(o.overdueAmount, { decimals: false })}
          full={formatINR(o.overdueAmount)}
          note={o.overdue ? `${o.overdue} invoice${o.overdue === 1 ? "" : "s"} · oldest ${o.oldestOverdueDays} day${o.oldestOverdueDays === 1 ? "" : "s"}` : "Nothing late"}
          tone={o.overdue ? "danger" : undefined}
        />
        <Kpi
          href="/payments?range=this_month"
          icon={CircleCheckBigIcon}
          label="Collected this month"
          value={formatINR(o.collectedMonth, { decimals: false })}
          full={formatINR(o.collectedMonth)}
          note={change === null ? "From recorded payments" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs ${formatINR(o.collectedLastMonth, { decimals: false })} last month`}
          tone="good"
        />
        <Kpi
          href="/invoices/paid"
          icon={TimerIcon}
          label="Avg. days to get paid"
          value={o.avgDaysToPay !== null && o.avgDaysSample >= 3 ? `${o.avgDaysToPay} day${o.avgDaysToPay === 1 ? "" : "s"}` : "—"}
          note={o.avgDaysSample >= 3 ? `Based on ${o.avgDaysSample} invoices paid in 90 days` : "Not enough data yet"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card title="Needs attention" description="Overdue, and due in the next 7 days." href={o.overdue ? "/invoices/overdue" : "/invoices/sent"}>
          {attention.length ? (
            <ul className="divide-y">
              {attention.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/40">
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">{inv.clientName || "No client"}</span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        {inv.number} · {inv.bucket === "overdue" ? <span className="text-red-600 dark:text-red-400">{inv.daysPastDue} day{inv.daysPastDue === 1 ? "" : "s"} late</span> : inv.daysPastDue === 0 ? "due today" : `due in ${-(inv.daysPastDue ?? 0)} day${inv.daysPastDue === -1 ? "" : "s"}`}
                      </span>
                    </span>
                    <StatusBadge invoice={inv} className="hidden sm:inline-flex" />
                    <span className="w-24 text-right font-semibold tabular-nums">{money(inv.balanceDue)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Quiet icon={CheckCircle2Icon} text="All clear. Nothing is late or due this week." />
          )}
        </Card>

        <Card title="Recent activity" description="What your clients did, what you sent and what came in.">
          {activity.length ? (
            <ul className="grid gap-0.5 px-2 py-2">
              {activity.map((a, i) => {
                const { icon: Icon, verb: baseVerb, tone } = ACTIVITY[a.type] ?? ACTIVITY.sent
                const verb = a.detail ?? baseVerb
                return (
                  <li key={`${a.invoiceId}-${a.at}-${i}`}>
                    <Link href={`/invoices/${a.invoiceId}`} className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted/50">
                      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", tone)}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          <span className="font-medium">{a.number || "Invoice"}</span> {verb}
                          {a.clientName && <span className="text-muted-foreground"> · {a.clientName}</span>}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">{when(a.at)}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Quiet icon={SendIcon} text="Send an invoice and you'll see when it's opened, downloaded and paid." />
          )}
        </Card>
      </div>

      <Card title="Top clients" description="By amount billed, with what each still owes." href="/clients">
        {topClients.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b bg-muted/40 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 text-right font-medium">Invoices</th>
                  <th className="px-4 py-2 text-right font-medium">Billed</th>
                  <th className="px-4 py-2 text-right font-medium">Owes you</th>
                  <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Last invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topClients.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/40">
                    <td className="max-w-56 truncate px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.invoices}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(c.billed)}</td>
                    <td className={cn("px-4 py-2.5 text-right font-medium tabular-nums", c.overdue > 0 && "text-red-600 dark:text-red-400")}>{c.outstanding ? money(c.outstanding) : "—"}</td>
                    <td className="hidden px-4 py-2.5 text-right text-muted-foreground tabular-nums sm:table-cell">{c.lastInvoiceDate ? formatDate(c.lastInvoiceDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Quiet icon={UsersIcon} text="Pick a saved client on your invoices to see who you bill most." />
        )}
      </Card>
    </div>
  )
}

const ACTIVITY: Record<string, { icon: LucideIcon; verb: string; tone: string }> = {
  sent: { icon: SendIcon, verb: "was sent", tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  viewed: { icon: EyeIcon, verb: "was opened", tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  downloaded: { icon: DownloadIcon, verb: "was downloaded", tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  paid: { icon: CircleCheckBigIcon, verb: "was paid", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  payment: { icon: WalletIcon, verb: "payment received", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  payment_deleted: { icon: Trash2Icon, verb: "payment deleted", tone: "bg-red-500/10 text-red-600 dark:text-red-400" },
  reminded: { icon: MessageCircleIcon, verb: "reminder sent", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  voided: { icon: BanIcon, verb: "was voided", tone: "bg-muted text-muted-foreground" },
  created: { icon: FilePlus2Icon, verb: "was started", tone: "bg-muted text-muted-foreground" },
}

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
function when(iso: string) {
  return dateTime.format(new Date(iso))
}

function Kpi({ href, icon: Icon, label, value, full, note, tone }: { href: string; icon: LucideIcon; label: string; value: string; full?: string; note: string; tone?: "danger" | "good" }) {
  return (
    <Link href={href} className="group relative rounded-xl border bg-background p-4 transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-[0_6px_24px_-14px_rgb(0_0_0/0.25)]">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className={cn("grid size-7 place-items-center rounded-lg", tone === "danger" ? "bg-red-500/10 text-red-600 dark:text-red-400" : tone === "good" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-brand/10 text-brand dark:text-[#6da2ff]")}>
          <Icon className="size-3.5" />
        </span>
      </span>
      <span title={full} className={cn("mt-2 block text-xl font-semibold tracking-[-0.02em] tabular-nums sm:text-2xl", tone === "danger" && "text-red-600 dark:text-red-400")}>
        {value}
      </span>
      <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate">{note}</span>
        <ArrowRightIcon className="size-3 shrink-0 opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100" />
      </span>
    </Link>
  )
}

function Card({ title, description, href, children }: { title: string; description: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-background">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="grid gap-0.5">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand hover:underline dark:text-[#6da2ff]">
            View all <ArrowRightIcon className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Quiet({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <p className="flex items-center gap-2.5 px-4 py-6 text-[13px] text-muted-foreground">
      <Icon className="size-4 shrink-0" /> {text}
    </p>
  )
}

/** First run: three steps from nothing to a sent invoice. */
function GettingStarted({ hasBusiness, hasClient }: { hasBusiness: boolean; hasClient: boolean }) {
  const steps = [
    { done: hasBusiness, title: "Add your business details", body: "Name, GSTIN and address, filled in on every invoice.", action: <OpenSettings tab="business" className={stepBtn}>Add details</OpenSettings> },
    { done: hasClient, title: "Add a client", body: "Save the people you bill, so their details are one click away.", action: <Link href="/clients" className={stepBtn}>Add a client</Link> },
    { done: false, title: "Create your first invoice", body: "Pick a template, add items, and send it or share a link.", action: <Link href="/create" className={cn(buttonVariants(), "h-7 px-2.5 text-xs")}>Create invoice</Link> },
  ]
  return (
    <div className="grid gap-6">
      <EmptyState icon={LayoutDashboardIcon} title="No invoices yet" body="Create an invoice to track collections, outstanding amounts and your top clients." action={{ label: "Create your first invoice", href: "/create" }} />
      <section className="overflow-hidden rounded-xl border bg-background">
        <div className="border-b px-4 py-3">
          <h2 className="text-[14px] font-semibold">Get set up</h2>
          <p className="text-xs text-muted-foreground">Three steps, a couple of minutes. Each one saves time on every invoice after.</p>
        </div>
        <ol className="divide-y">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold", s.done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")}>
                {s.done ? <CheckCircle2Icon className="size-3.5" /> : i + 1}
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className={cn("text-[13px] font-medium", s.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{s.title}</span>
                <span className="text-xs text-muted-foreground">{s.body}</span>
              </span>
              {!s.done && s.action}
            </li>
          ))}
        </ol>
      </section>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <HourglassIcon className="size-3.5" /> Prefer to start straight away? <Link href="/create" className="font-medium text-brand hover:underline dark:text-[#6da2ff]">Make an invoice</Link> and save details as you go.
      </p>
    </div>
  )
}

const stepBtn = "inline-flex h-7 shrink-0 items-center rounded-md border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted"

function OverviewSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  )
}
