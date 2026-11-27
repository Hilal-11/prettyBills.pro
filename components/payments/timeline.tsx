import Link from "next/link"
import { AlarmClockIcon, BanIcon, CircleCheckBigIcon, DownloadIcon, EyeIcon, FilePlus2Icon, MailIcon, MailWarningIcon, MessageCircleIcon, PencilLineIcon, ReceiptTextIcon, SendIcon, Share2Icon, Trash2Icon, WalletIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { formatDate } from "@/lib/billing/dates"
import { isMode, MODE_LABEL } from "@/lib/billing/modes"
import { formatINR } from "@/lib/billing/money"
import type { ActivityItem } from "@/lib/data/types"

/**
 * What happened, newest first: payments, receipts and the invoice's own
 * events in one list. Each line says who did it, when (relative, with the
 * exact time on hover) and what changed.
 */

const tone = {
  money: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  client: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  bad: "bg-red-500/10 text-red-600 dark:text-red-400",
  muted: "bg-muted text-muted-foreground",
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null)
const str = (v: unknown) => (typeof v === "string" && v ? v : null)
const mode = (v: unknown) => (isMode(v) ? MODE_LABEL[v] : str(v) ?? "")
const STATE: Record<string, string> = { paid: "Paid", partially_paid: "Partially paid", unpaid: "Unpaid" }

function changes(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: string[] = []
  for (const k of Object.keys(after)) {
    const a = before[k]
    const b = after[k]
    if (k === "amount_paise") out.push(`amount ${formatINR(num(a) ?? 0)} → ${formatINR(num(b) ?? 0)}`)
    else if (k === "paid_on") out.push(`date ${formatDate(str(a))} → ${formatDate(str(b))}`)
    else if (k === "mode") out.push(`mode ${mode(a)} → ${mode(b)}`)
    else if (k === "reference") out.push(`reference ${str(a) ?? "none"} → ${str(b) ?? "none"}`)
    else if (k === "note") out.push("the note")
  }
  return out.join(", ")
}

function describe(a: ActivityItem): { icon: LucideIcon; tone: string; text: string } | null {
  const d = a.data
  const who = a.actor === "you" ? "You" : "Someone"
  const inv = a.invoiceNumber ?? str(d.invoice_number) ?? "the invoice"
  switch (a.action) {
    case "payment.recorded":
      return { icon: WalletIcon, tone: tone.money, text: `${who} recorded ${formatINR(num(d.amount_paise) ?? 0)} via ${mode(d.mode)}${str(d.reference) ? ` (${d.mode === "cheque" ? "cheque" : "ref"} ${d.reference})` : ""} on ${inv}${str(d.receipt_number) ? ` · Receipt ${d.receipt_number}` : ""}` }
    case "payment.updated":
      return { icon: PencilLineIcon, tone: tone.info, text: `${who} changed the payment on ${inv}: ${changes((d.before ?? {}) as Record<string, unknown>, (d.after ?? {}) as Record<string, unknown>) || "details"}` }
    case "payment.deleted":
      return { icon: Trash2Icon, tone: tone.bad, text: `${who} deleted a payment of ${formatINR(num(d.amount_paise) ?? 0)} on ${inv}${str(d.reason) ? ` · Reason: ${d.reason}` : ""}` }
    case "receipt.created":
      return { icon: ReceiptTextIcon, tone: tone.muted, text: `Receipt ${str(d.number) ?? ""} created` }
    case "receipt.revised":
      return { icon: ReceiptTextIcon, tone: tone.info, text: `Receipt ${str(d.number) ?? ""} revised (revision ${num(d.revision) ?? 2})${d.fy_changed ? ". Its number keeps the original financial year." : ""}` }
    case "receipt.voided":
      return { icon: BanIcon, tone: tone.muted, text: `Receipt ${str(d.number) ?? ""} voided${str(d.reason) ? ` · ${d.reason}` : ""}` }
    case "receipt.emailed":
      return { icon: MailIcon, tone: tone.info, text: `Receipt ${str(d.number) ?? ""} emailed to ${Array.isArray(d.to) ? d.to.join(", ") : "the client"}${d.outbox ? " (dev outbox)" : ""}` }
    case "receipt.email_failed":
      return { icon: MailWarningIcon, tone: tone.bad, text: `Receipt ${str(d.number) ?? ""} email failed${str(d.error) ? `: ${d.error}` : ""}` }
    case "receipt.shared":
      return { icon: Share2Icon, tone: tone.muted, text: `${who} shared receipt ${str(d.number) ?? ""}` }
    case "invoice.payment_state_changed":
      return { icon: CircleCheckBigIcon, tone: d.after === "paid" ? tone.money : tone.muted, text: `${inv} is now ${STATE[str(d.after) ?? ""] ?? d.after}` }
    case "invoice.became_overdue":
      return { icon: AlarmClockIcon, tone: tone.bad, text: `${inv} became overdue` }
    case "invoice.sent":
      return { icon: SendIcon, tone: tone.info, text: d.manual ? `${who} marked ${inv} as sent` : `${who} emailed ${inv}` }
    case "invoice.viewed":
      return { icon: EyeIcon, tone: tone.client, text: `The client opened ${inv}` }
    case "invoice.downloaded":
      return { icon: DownloadIcon, tone: tone.client, text: `The client downloaded ${inv}` }
    case "invoice.reminded":
      return { icon: MessageCircleIcon, tone: tone.warn, text: `${who} sent a reminder for ${inv}` }
    case "invoice.voided":
      return { icon: BanIcon, tone: tone.muted, text: `${who} voided ${inv}` }
    case "invoice.created":
      return { icon: FilePlus2Icon, tone: tone.muted, text: `${who} started ${inv}` }
    default:
      return null
  }
}

const exact = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`
  return exact.format(new Date(iso)).split(",")[0]
}

export function Timeline({ items, now, hide = [], linkInvoices = false, empty = "Nothing has happened yet." }: { items: ActivityItem[]; now: number; hide?: string[]; linkInvoices?: boolean; empty?: string }) {
  const lines = items.filter((i) => !hide.includes(i.action)).map((i) => ({ i, d: describe(i) })).filter((x): x is { i: ActivityItem; d: NonNullable<ReturnType<typeof describe>> } => !!x.d)
  if (!lines.length) return <p className="px-4 py-6 text-[13px] text-muted-foreground">{empty}</p>
  return (
    <ol className="grid gap-0.5 px-2 py-2">
      {lines.map(({ i, d }) => {
        const body = (
          <>
            <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", d.tone)}>
              <d.icon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] leading-snug">{d.text}</span>
              <time dateTime={i.at} title={exact.format(new Date(i.at))} className="block text-[11px] text-muted-foreground">
                {ago(i.at, now)}
              </time>
            </span>
          </>
        )
        return (
          <li key={i.id}>
            {linkInvoices && i.invoiceId ? (
              <Link href={`/invoices/${i.invoiceId}`} className="flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-2.5 px-2 py-1.5">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
