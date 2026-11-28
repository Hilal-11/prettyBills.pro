"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import {
  BanIcon,
  CalendarClockIcon,
  CircleCheckBigIcon,
  DownloadIcon,
  EyeIcon,
  FilePlus2Icon,
  LayoutTemplateIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  ScrollTextIcon,
  SendIcon,
  Trash2Icon,
  UserPlusIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { reminderAction } from "@/app/(app)/invoices/actions"
import { StatusBadge } from "@/components/app/status"
import { useToast } from "@/components/invoice-editor/toast"
import { ClientChip } from "@/components/invoices/client-chip"
import { addDays, formatDate } from "@/lib/billing/dates"
import type { WidgetType } from "@/lib/dashboard/boards"
import type { InvoiceSummary } from "@/lib/data/types"
import { formatMoney } from "@/lib/invoice/totals"
import type { DashboardData } from "@/lib/server/db/dashboard"
import { spring } from "@/lib/motion"

import { AgeingChart, CashflowChart, DaysToPayChart, ForecastChart, MethodsChart, Quiet, StatusChart, TopClientsChart } from "./lazy-charts"

const money = (p: number) => formatMoney(p, { whole: true })
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`

/** Where each card's "see all" link goes. */
export const WIDGET_LINK: Partial<Record<WidgetType, { href: string; label: string }>> = {
  cashflow: { href: "/payments", label: "Payments" },
  ageing: { href: "/invoices?view=overdue", label: "Overdue" },
  status: { href: "/invoices", label: "Invoices" },
  methods: { href: "/payments", label: "Payments" },
  topClients: { href: "/clients", label: "Clients" },
  forecast: { href: "/invoices?view=upcoming", label: "Upcoming" },
  overdue: { href: "/invoices?view=overdue", label: "All overdue" },
  upcoming: { href: "/invoices?view=upcoming", label: "Upcoming" },
  recent: { href: "/invoices?sort=updated&dir=desc", label: "Invoices" },
}

/** The body of one card. Every card reads from the same dashboard data. */
export function Widget({ type, data, wide }: { type: WidgetType; data: DashboardData; wide: boolean }) {
  switch (type) {
    case "cashflow":
      return <CashflowChart data={data.charts.monthly} tall={wide} />
    case "ageing":
      return <AgeingChart ageing={data.charts.ageing} />
    case "status":
      return <StatusChart status={data.charts.status} />
    case "methods":
      return <MethodsChart methods={data.charts.methods} />
    case "topClients":
      return <TopClientsChart clients={data.charts.topClients} />
    case "forecast":
      return <ForecastChart ahead={data.insights.ahead} labels={data.insights.ahead.map((_, k) => (k === 0 ? "This wk" : formatDate(addDays(data.today, 7 * k)).slice(0, 6)))} />
    case "daysToPay":
      return <DaysToPayChart data={data.charts.daysToPay} />
    case "overdue":
      return data.overdue.length ? <InvoiceRows invoices={data.overdue} kind="overdue" /> : <Quiet>Nothing overdue. Every sent invoice is paid or not yet due.</Quiet>
    case "upcoming":
      return data.upcoming.length ? <InvoiceRows invoices={data.upcoming} kind="upcoming" /> : <Quiet>Nothing falls due in the next two weeks.</Quiet>
    case "recent":
      return data.recent.length ? <InvoiceRows invoices={data.recent} kind="recent" /> : <Quiet>Your latest invoices show up here.</Quiet>
    case "activity":
      return <ActivityFeed activity={data.activity} quotesAwaiting={data.quotesAwaiting} />
    case "shortcuts":
      return <Shortcuts />
  }
}

/* --------------------------------- lists --------------------------------- */

export function InvoiceRows({ invoices, kind }: { invoices: InvoiceSummary[]; kind: "overdue" | "upcoming" | "recent" }) {
  return (
    <ul className="divide-y">
      {invoices.map((inv, i) => (
        <motion.li key={inv.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.03 }} className="group relative flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
          <span className="grid min-w-0 flex-1 gap-0.5">
            <Link href={`/invoices/${inv.id}`} className="flex min-w-0 items-center gap-2 text-[13px] font-medium outline-none after:absolute after:inset-0 focus-visible:underline">
              <ClientChip name={inv.clientName} />
              <span className="truncate">{inv.clientName || "No client yet"}</span>
            </Link>
            <span className="truncate text-xs text-muted-foreground tabular-nums">
              {inv.number || "Draft"} · {money(kind === "recent" ? inv.total : inv.balanceDue)}
              {kind === "overdue" && <span className="text-red-600 dark:text-red-400"> · {days(inv.daysPastDue ?? 0)} late</span>}
              {kind === "upcoming" && (
                <span className={cn(inv.daysPastDue === 0 && "text-amber-700 dark:text-amber-400")}> · {inv.daysPastDue === 0 ? "due today" : `due in ${days(-(inv.daysPastDue ?? 0))}`}</span>
              )}
            </span>
          </span>
          {kind === "recent" ? <StatusBadge invoice={inv} /> : <Remind inv={inv} />}
        </motion.li>
      ))}
    </ul>
  )
}

/** A WhatsApp reminder with the link and amount filled in. Opens the tab first so it isn't blocked as a popup. */
function Remind({ inv }: { inv: InvoiceSummary }) {
  const toast = useToast()
  const [busy, setBusy] = React.useState(false)
  return (
    <button
      type="button"
      title={`Remind ${inv.clientName || "the client"} on WhatsApp`}
      aria-label={`Remind about ${inv.number} on WhatsApp`}
      disabled={busy}
      onClick={async () => {
        const tab = window.open("", "_blank")
        setBusy(true)
        const r = await reminderAction(inv.id).catch(() => ({ ok: false as const, error: "You seem to be offline. Try again." }))
        setBusy(false)
        if (r.ok && tab) tab.location.href = r.whatsapp
        else {
          tab?.close()
          if (!r.ok) toast({ title: r.error, tone: "error" })
        }
      }}
      className="relative z-10 grid size-7 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground opacity-80 transition-[opacity,color,background-color] group-hover:opacity-100 hover:bg-muted hover:text-emerald-600 disabled:opacity-60 dark:hover:text-emerald-400"
    >
      {busy ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <FaWhatsapp className="size-3.5" />}
    </button>
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

const stamp = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })

function ActivityFeed({ activity, quotesAwaiting = 0 }: { activity: DashboardData["activity"]; quotesAwaiting?: number }) {
  // only when there's something waiting: one line, above the feed
  const waiting = quotesAwaiting > 0 && (
    <Link href="/quotes?tab=open" className="mx-2 mt-2 flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-[13px] text-foreground/80 transition-colors hover:bg-muted/50">
      <ScrollTextIcon className="size-3.5 text-muted-foreground" />
      <span className="flex-1">
        {quotesAwaiting} {quotesAwaiting === 1 ? "quote" : "quotes"} awaiting response
      </span>
      <span className="text-xs text-muted-foreground">View</span>
    </Link>
  )
  if (!activity.length)
    return waiting ? <div className="grid">{waiting}<Quiet>Send an invoice and you&apos;ll see when it&apos;s opened, downloaded and paid.</Quiet></div> : <Quiet>Send an invoice and you&apos;ll see when it&apos;s opened, downloaded and paid.</Quiet>
  return (
    <>
    {waiting}
    <ul className="grid gap-0.5 p-2">
      {activity.map((a, i) => {
        const { icon: Icon, verb, tone } = ACTIVITY[a.type] ?? ACTIVITY.sent
        return (
          <motion.li key={`${a.invoiceId}-${a.at}-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.03 }}>
            <Link href={`/invoices/${a.invoiceId}`} className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted/50">
              <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", tone)}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  <span className="font-medium">{a.number || "Invoice"}</span> {a.detail ?? verb}
                  {a.clientName && <span className="text-muted-foreground"> · {a.clientName}</span>}
                </span>
                <span className="block text-[11px] text-muted-foreground">{stamp.format(new Date(a.at))}</span>
              </span>
            </Link>
          </motion.li>
        )
      })}
    </ul>
    </>
  )
}

/* ------------------------------- shortcuts ------------------------------- */

const SHORTCUTS: { href: string; label: string; note: string; icon: LucideIcon; download?: boolean }[] = [
  { href: "/create", label: "New invoice", note: "Start from your last template", icon: FilePlus2Icon },
  { href: "/clients?new=1", label: "Add a client", note: "GSTIN fills the state", icon: UserPlusIcon },
  { href: "/invoices?view=sent", label: "Record a payment", note: "Against a sent invoice", icon: WalletIcon },
  { href: "/invoices?view=overdue", label: "Chase overdue", note: "Remind on WhatsApp", icon: CalendarClockIcon },
  { href: "/templates", label: "Templates", note: "Switch the look", icon: LayoutTemplateIcon },
  { href: "/api/invoices/export", label: "Export invoices", note: "CSV for your CA", icon: DownloadIcon, download: true },
]

function Shortcuts() {
  return (
    <div className="grid grid-cols-2 gap-px bg-border">
      {SHORTCUTS.map((s) => {
        const body = (
          <>
            <span className="grid size-7 place-items-center rounded-lg bg-brand/10 text-brand transition-transform group-hover:-translate-y-0.5 dark:text-[#6da2ff]">
              <s.icon className="size-3.5" />
            </span>
            <span className="mt-2 block text-[13px] font-medium">{s.label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{s.note}</span>
          </>
        )
        const cls = "group block bg-background px-4 py-3 transition-colors hover:bg-muted/40"
        return s.download ? (
          <a key={s.label} href={s.href} download className={cls}>
            {body}
          </a>
        ) : (
          <Link key={s.label} href={s.href} className={cls}>
            {body}
          </Link>
        )
      })}
    </div>
  )
}
