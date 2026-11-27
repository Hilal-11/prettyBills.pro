"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BanIcon,
  CheckCircle2Icon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FilesIcon,
  LinkIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  SendIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { deleteDraftAction, duplicateAction, reminderAction, shareLinkAction, voidAction } from "@/app/(app)/invoices/actions"
import { markSentAction, payInFullAction, paymentContextAction } from "@/app/(app)/payments/actions"
import { RecordPaymentDialog } from "@/components/payments/record-dialog"
import { formatINR } from "@/lib/billing/money"
import { isMode, MODE_LABEL } from "@/lib/billing/modes"
import { useToast } from "@/components/invoice-editor/toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { invoicesChanged } from "@/lib/client/workspace"
import type { InvoiceSummary } from "@/lib/data/types"
import { formatDate } from "@/lib/invoice/format"
import { formatMoney } from "@/lib/invoice/totals"

import { StatusBadge } from "./status"

export type ListView = "all" | "draft" | "sent" | "overdue" | "paid"

const item = "gap-2 py-1.5 text-[13px]"

/** "3 days", "1 day" */
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`

/** Short date: "25 Nov" this year, "25 Nov 2025" otherwise. */
function short(iso: string | null | undefined, year: string) {
  if (!iso) return "—"
  const full = formatDate(iso.slice(0, 10))
  return full.endsWith(year) ? full.slice(0, -5) : full
}

/**
 * The invoice list behind /invoices and its views. One component so every view
 * looks and behaves the same; each view picks its own columns, main action
 * and menu, because each answers a different question:
 * drafts "what's left to finish?", sent "who owes me and when?",
 * overdue "who do I chase?", paid "what came in?".
 */
export function InvoiceList({ invoices, view, today }: { invoices: InvoiceSummary[]; view: ListView; today: string }) {
  const year = today.slice(0, 4)
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="hidden grid-cols-(--cols) gap-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid" style={{ "--cols": COLS[view] } as React.CSSProperties}>
        {HEADERS[view].map((h, i) => (
          <span key={h + i} className={cn((h === "Amount" || h === "Balance") && "text-right")}>
            {h}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {invoices.map((inv) => (
          <Row key={inv.id} inv={inv} view={view} year={year} />
        ))}
      </ul>
    </div>
  )
}

const COLS: Record<ListView, string> = {
  all: "minmax(0,2.2fr) 1fr 1fr 1fr 7rem 9.5rem",
  draft: "minmax(0,2.4fr) 1fr 1.2fr 1fr 9.5rem",
  sent: "minmax(0,2.2fr) 1fr 1fr 1.1fr 1fr 9.5rem",
  overdue: "minmax(0,2.4fr) 1fr 1fr 1fr 9.5rem",
  paid: "minmax(0,2.4fr) 1fr 1fr 1fr 9.5rem",
}

const HEADERS: Record<ListView, string[]> = {
  all: ["Invoice", "Issued", "Due", "Amount", "Status", ""],
  draft: ["Draft", "Last edited", "Ready to send?", "Amount", ""],
  sent: ["Invoice", "Sent", "Due", "Opened", "Balance", ""],
  overdue: ["Invoice", "Was due", "Late by", "Balance", ""],
  paid: ["Invoice", "Issued", "Paid on", "Amount", ""],
}

function Row({ inv, view, year }: { inv: InvoiceSummary; view: ListView; year: string }) {
  const href = `/invoices/${inv.id}`
  const money = (n: number) => formatMoney(n, { whole: n % 100 === 0 })

  const cells: Record<ListView, React.ReactNode[]> = {
    all: [short(inv.issueDate, year), inv.dueDate ? short(inv.dueDate, year) : "—", <Amount key="a" value={money(inv.total)} />, <StatusBadge key="s" invoice={inv} />],
    draft: [
      short(inv.updatedAt, year),
      inv.missingFields === 0 ? (
        <span key="r" className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2Icon className="size-3.5" /> Ready
        </span>
      ) : (
        <span key="r" className="text-amber-700 dark:text-amber-400">{inv.missingFields} to fill in</span>
      ),
      <Amount key="a" value={money(inv.total)} />,
    ],
    sent: [
      short(inv.sentAt ?? inv.issueDate, year),
      inv.daysPastDue == null ? "No due date" : inv.daysPastDue === 0 ? <span key="d" className="text-amber-700 dark:text-amber-400">Today</span> : `In ${days(-inv.daysPastDue)}`,
      inv.viewedAt ? (
        <span key="v" className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-400">
          <EyeIcon className="size-3.5" /> {short(inv.viewedAt, year)}
        </span>
      ) : (
        <span key="v" className="inline-flex items-center gap-1 text-muted-foreground">
          <EyeOffIcon className="size-3.5" /> Not yet
        </span>
      ),
      <Amount key="a" value={money(inv.balanceDue)} />,
    ],
    overdue: [short(inv.dueDate, year), <span key="l" className="font-medium text-red-600 dark:text-red-400">{days(inv.daysPastDue ?? 0)}</span>, <Amount key="a" value={money(inv.balanceDue)} />],
    paid: [short(inv.issueDate, year), short(inv.paidAt, year), <Amount key="a" value={money(inv.total)} />],
  }

  return (
    <li className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-[13px] transition-colors hover:bg-muted/40 md:grid-cols-(--cols)" style={{ "--cols": COLS[view] } as React.CSSProperties}>
      <Link href={href} className="min-w-0 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold tabular-nums">{inv.number || "No number"}</span>
          {view === "all" ? null : <StatusBadge invoice={inv} className="md:hidden" />}
        </span>
        <span className="block truncate text-muted-foreground">{inv.clientName || "No client yet"}</span>
      </Link>
      {/* desktop cells */}
      {cells[view].map((c, i) => (
        <span key={i} className="hidden truncate text-foreground/85 tabular-nums md:block">
          {c}
        </span>
      ))}
      {/* phone: the one number that matters, then actions */}
      <span className="text-right font-semibold tabular-nums md:hidden">{money(view === "sent" || view === "overdue" ? inv.balanceDue : inv.total)}</span>
      <div className="relative z-10 col-span-2 flex items-center justify-end gap-1 md:col-span-1">
        <Actions inv={inv} view={view} />
      </div>
    </li>
  )
}

function Amount({ value }: { value: string }) {
  return <span className="block text-right font-medium tabular-nums">{value}</span>
}

/* ------------------------------- actions ------------------------------- */

type Confirm = { kind: "delete" | "void" | "paid"; inv: InvoiceSummary; detail?: string; key?: string } | null

function Actions({ inv, view }: { inv: InvoiceSummary; view: ListView }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [confirm, setConfirm] = React.useState<Confirm>(null)
  const [recording, setRecording] = React.useState(false)
  const bucket = inv.bucket

  async function act<T extends object>(key: string, fn: () => Promise<({ ok: true } & T) | { ok: false; error: string }>, success?: (r: T) => string | void) {
    setBusy(key)
    const result = await fn().catch(() => ({ ok: false as const, error: "You seem to be offline. Try again." }))
    setBusy(null)
    if (!result.ok) return toast({ title: result.error, tone: "error" })
    invoicesChanged()
    const message = success?.(result as T)
    if (message) toast({ title: message, tone: "success", duration: 2500 })
    return result as { ok: true } & T
  }

  // "Mark as paid" records the full balance, today, by the mode used last: confirm that first
  const paid = async () => {
    setBusy("paid")
    const ctx = await paymentContextAction(inv.id).catch(() => null)
    setBusy(null)
    if (!ctx?.ok) return toast({ title: ctx?.error ?? "You seem to be offline. Try again.", tone: "error" })
    const mode = isMode(ctx.lastMode) ? MODE_LABEL[ctx.lastMode] : "UPI"
    setConfirm({ kind: "paid", inv, detail: `Record ${formatINR(ctx.invoice.balanceDue)} received today via ${mode}? A receipt is made for it.`, key: crypto.randomUUID() })
  }
  const confirmPaid = (key: string) =>
    act<{ result: { receipt: { number: string } } }>("paid", () => payInFullAction(inv.id, key), (r) => `${inv.number} marked as paid · Receipt ${r.result.receipt.number}`)
  const markSent = () => act("sent", () => markSentAction(inv.id), () => `${inv.number} marked as sent`)
  const duplicate = async () => {
    const r = await act<{ id: string }>("dup", () => duplicateAction(inv.id))
    if (r) router.push(`/invoices/${r.id}`)
  }
  const copyLink = async () => {
    const r = await act<{ url: string }>("link", () => shareLinkAction(inv.id))
    if (!r) return
    await navigator.clipboard.writeText(r.url).catch(() => {})
    toast({ title: "Link copied", description: r.url, tone: "success", duration: 3000 })
  }
  const remind = async () => {
    // open the tab first, so browsers don't block it as a popup
    const tab = window.open("", "_blank")
    const r = await act<{ whatsapp: string }>("remind", () => reminderAction(inv.id))
    if (r && tab) tab.location.href = r.whatsapp
    else tab?.close()
  }
  const pdf = `/api/invoices/${inv.id}/pdf`

  const spinner = (key: string, icon: React.ReactNode) => (busy === key ? <LoaderCircleIcon className="animate-spin" /> : icon)
  const primaryCls = "h-7 gap-1.5 px-2.5 text-xs"

  const primary =
    bucket === "draft" ? (
      <Link href={`/invoices/${inv.id}`} className={cn(buttonVariants({ variant: "outline" }), primaryCls)}>
        <PencilLineIcon /> Continue
      </Link>
    ) : bucket === "overdue" ? (
      <Button variant="outline" className={primaryCls} disabled={!!busy} onClick={remind}>
        {spinner("remind", <FaWhatsapp className="text-emerald-600 dark:text-emerald-400" />)} Remind
      </Button>
    ) : bucket === "sent" ? (
      <Button variant="outline" className={primaryCls} disabled={!!busy} onClick={paid}>
        {spinner("paid", <CheckCircle2Icon />)} Mark paid
      </Button>
    ) : bucket === "paid" ? (
      <a href={pdf} download className={cn(buttonVariants({ variant: "outline" }), primaryCls)}>
        <DownloadIcon /> PDF
      </a>
    ) : null

  return (
    <>
      {view !== "all" && primary}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${inv.number || "this draft"}`} disabled={!!busy} className="text-foreground/70" />}>
          {busy && view === "all" ? <LoaderCircleIcon className="animate-spin" /> : <MoreHorizontalIcon />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 rounded-xl p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuItem className={item} render={<Link href={`/invoices/${inv.id}`} />}>
              <PencilLineIcon /> {bucket === "draft" ? "Continue editing" : "Open"}
            </DropdownMenuItem>
            {bucket === "sent" || bucket === "overdue" ? (
              <>
                <DropdownMenuItem className={item} onClick={() => setRecording(true)}>
                  <WalletIcon /> Record payment
                </DropdownMenuItem>
                {bucket === "overdue" && (
                  <DropdownMenuItem className={item} onClick={paid}>
                    <CheckCircle2Icon /> Mark as paid
                  </DropdownMenuItem>
                )}
                {bucket === "sent" && (
                  <DropdownMenuItem className={item} onClick={remind}>
                    <FaWhatsapp /> Remind on WhatsApp
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={item} onClick={copyLink}>
                  <LinkIcon /> Copy link
                </DropdownMenuItem>
              </>
            ) : null}
            {bucket === "paid" && (
              <DropdownMenuItem className={item} onClick={copyLink}>
                <LinkIcon /> Copy link
              </DropdownMenuItem>
            )}
            {bucket !== "draft" && (
              <DropdownMenuItem className={item} render={<a href={pdf} download />}>
                <DownloadIcon /> Download PDF
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className={item} onClick={duplicate}>
              {bucket === "draft" ? <CopyIcon /> : <FilesIcon />} Duplicate
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {(bucket === "draft" || bucket === "sent" || bucket === "overdue" || bucket === "paid") && <DropdownMenuSeparator />}
          {bucket === "paid" && (
            <DropdownMenuItem className={item} render={<Link href={`/invoices/${inv.id}#payments`} />}>
              <WalletIcon /> Payments and receipts
            </DropdownMenuItem>
          )}
          {bucket === "draft" && inv.missingFields === 0 && (
            <DropdownMenuItem className={item} onClick={markSent}>
              <SendIcon /> Mark as sent
            </DropdownMenuItem>
          )}
          {bucket === "draft" && (
            <DropdownMenuItem variant="destructive" className={item} onClick={() => setConfirm({ kind: "delete", inv })}>
              <Trash2Icon /> Delete draft
            </DropdownMenuItem>
          )}
          {(bucket === "sent" || bucket === "overdue") && (
            <DropdownMenuItem variant="destructive" className={item} onClick={() => setConfirm({ kind: "void", inv })}>
              <BanIcon /> Void invoice
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "paid" ? `Mark ${inv.number} as paid?` : confirm?.kind === "void" ? `Void ${inv.number}?` : "Delete this draft?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "paid"
                ? confirm.detail
                : confirm?.kind === "void"
                  ? "The invoice stays on record with its number, marked void, and its link stops working. Use this when an invoice was sent by mistake. It can't be undone."
                  : `${inv.number || "This draft"}${inv.clientName ? ` for ${inv.clientName}` : ""} will be deleted. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            {confirm?.kind === "paid" && (
              <Button
                variant="outline"
                className="h-8 text-[13px]"
                onClick={() => {
                  setConfirm(null)
                  setRecording(true)
                }}
              >
                Edit details
              </Button>
            )}
            <AlertDialogAction
              variant={confirm?.kind === "paid" ? "default" : "destructive"}
              className="h-8 text-[13px]"
              onClick={async () => {
                const c = confirm
                setConfirm(null)
                if (c?.kind === "paid" && c.key) await confirmPaid(c.key)
                if (c?.kind === "delete") await act("del", () => deleteDraftAction(inv.id), () => "Draft deleted")
                if (c?.kind === "void") await act("void", () => voidAction(inv.id), () => `${inv.number} voided`)
              }}
            >
              {confirm?.kind === "paid" ? "Confirm" : confirm?.kind === "void" ? "Void invoice" : "Delete draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {(bucket === "sent" || bucket === "overdue") && <RecordPaymentDialog open={recording} onOpenChange={setRecording} invoiceId={inv.id} />}
    </>
  )
}
