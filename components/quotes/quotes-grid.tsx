"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BanIcon,
  CalendarClockIcon,
  CalendarIcon,
  CheckIcon,
  CircleDotIcon,
  CopyIcon,
  CopyPlusIcon,
  DownloadIcon,
  EllipsisIcon,
  FileTextIcon,
  IndianRupeeIcon,
  LinkIcon,
  PencilIcon,
  ScrollTextIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"

import { duplicateQuoteAction } from "@/app/(app)/quotes/actions"
import { cell, HeadCell } from "@/components/app/data-table"
import { useToast } from "@/components/invoice-editor/toast"
import { ClientChip } from "@/components/invoices/client-chip"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDate } from "@/lib/billing/dates"
import { formatINR } from "@/lib/billing/money"
import { quoteLabel } from "@/lib/billing/quotes"
import type { QuoteSummary } from "@/lib/server/db/quotes"

import { ConvertDialog } from "./convert-dialog"
import { MarkStatusDialog, ReviseDialog, VoidQuoteDialog } from "./quote-dialogs"
import { QuoteStatusBadge } from "./quote-status"

type Dialog = { kind: "convert"; q: QuoteSummary; target: "invoice" | "proforma" } | { kind: "mark"; q: QuoteSummary; status: "accepted" | "declined" } | { kind: "void"; q: QuoteSummary } | { kind: "revise"; q: QuoteSummary } | null

/** The quotes (or proformas) table, edge to edge like Credit notes. A row opens the quote. */
export function QuotesGrid({ quotes, after }: { quotes: QuoteSummary[]; after?: React.ReactNode }) {
  const router = useRouter()
  const [dialog, setDialog] = React.useState<Dialog>(null)
  const cols: [string, number][] = [
    ["#", 40],
    ["number", 170],
    ["date", 112],
    ["client", 200],
    ["valid", 150],
    ["amount", 130],
    ["status", 120],
    ["menu", 48],
  ]
  const live = quotes.filter((q) => q.status !== "void")
  const close = () => setDialog(null)
  return (
    <div className="relative min-h-0 flex-1 overflow-auto">
      <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]" style={{ minWidth: cols.reduce((s, [, w]) => s + w, 0) }}>
        <colgroup>
          {cols.map(([k, w]) => (
            <col key={k} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-20">
          <tr>
            <th scope="col" className={cn(cell.th, "sticky left-0 z-10 px-0")}>
              <span className="sr-only">Row</span>
            </th>
            <HeadCell icon={ScrollTextIcon} label="Number" className="sticky left-10 z-10" />
            <HeadCell icon={CalendarIcon} label="Date" />
            <HeadCell icon={UsersIcon} label="Client" />
            <HeadCell icon={CalendarClockIcon} label="Valid until" />
            <HeadCell icon={IndianRupeeIcon} label="Amount" right />
            <HeadCell icon={CircleDotIcon} label="Status" />
            <th scope="col" className={cn(cell.th, "border-r-0 px-0")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q, i) => {
            const tone = q.display === "expired" ? "danger" : q.status === "sent" && q.daysLeft !== null && q.daysLeft <= 3 ? "warning" : null
            return (
              <tr
                key={q.id}
                onClick={(e) => {
                  const t = e.target as HTMLElement
                  if (t.closest("a, button, [role=menu]") || window.getSelection()?.toString()) return
                  router.push(q.status === "draft" ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`)
                }}
                className={cn(cell.row, "cursor-pointer", q.status === "void" && "text-muted-foreground")}
              >
                <td className={cn(cell.td, "sticky left-0 z-[1] px-0 text-center text-xs text-muted-foreground tabular-nums")}>{i + 1}</td>
                <td className={cn(cell.td, "sticky left-10 z-[1] tabular-nums")}>
                  <Link href={q.status === "draft" ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`} className={cn("font-medium hover:underline", q.status === "void" && "line-through")}>
                    {quoteLabel(q.number, q.revision)}
                  </Link>
                </td>
                <td className={cn(cell.td, "tabular-nums")}>{formatDate(q.issueDate)}</td>
                <td className={cell.td}>
                  <span className="flex min-w-0 items-center gap-2">
                    {q.clientName && <ClientChip name={q.clientName} />}
                    {q.clientId ? (
                      <Link href={`/clients/${encodeURIComponent(q.clientId)}?tab=quotes`} className="truncate hover:underline">
                        {q.clientName || "—"}
                      </Link>
                    ) : (
                      <span className="truncate text-muted-foreground">No client yet</span>
                    )}
                  </span>
                </td>
                <td className={cn(cell.td, "tabular-nums", tone === "danger" && "font-medium text-red-600 dark:text-red-400", tone === "warning" && "font-medium text-amber-700 dark:text-amber-400")}>
                  {q.validUntil ? (
                    <>
                      {formatDate(q.validUntil)}
                      {q.status === "sent" && q.daysLeft !== null && <span className="ml-1.5 text-xs font-normal opacity-80">{q.daysLeft < 0 ? `${-q.daysLeft}d ago` : q.daysLeft === 0 ? "today" : `${q.daysLeft}d left`}</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </td>
                <td className={cn(cell.td, "text-right font-semibold tabular-nums", q.status === "void" && "font-normal line-through")}>
                  {formatINR(q.total)}
                  {q.convertedPaise > 0 && q.convertedPaise < q.total && <span className="block text-[11px] leading-none font-normal text-muted-foreground">{formatINR(q.convertedPaise, { decimals: false })} invoiced</span>}
                </td>
                <td className={cell.td}>
                  <QuoteStatusBadge display={q.display} />
                </td>
                <td className={cn(cell.td, "border-r-0 px-1 text-center")}>
                  <RowMenu q={q} open={setDialog} />
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="sticky bottom-0 z-20">
          <tr>
            <td colSpan={5} className={cn(cell.tf, "sticky left-0 z-10 text-muted-foreground")}>
              {quotes.length} shown{live.length !== quotes.length ? ` · total leaves out ${quotes.length - live.length} void` : ""}
            </td>
            <td className={cn(cell.tf, "text-right tabular-nums")}>
              <span className="text-muted-foreground">Σ </span>
              <span className="font-medium">{formatINR(live.reduce((s, q) => s + q.total, 0), { decimals: false })}</span>
            </td>
            <td colSpan={2} className={cn(cell.tf, "border-r-0")} />
          </tr>
        </tfoot>
      </table>
      {after}

      {dialog?.kind === "convert" && <ConvertDialog quoteId={dialog.q.id} target={dialog.target} open onOpenChange={(o) => !o && close()} />}
      {dialog?.kind === "mark" && <MarkStatusDialog id={dialog.q.id} number={quoteLabel(dialog.q.number, dialog.q.revision)} status={dialog.status} open onOpenChange={(o) => !o && close()} />}
      {dialog?.kind === "void" && <VoidQuoteDialog id={dialog.q.id} number={dialog.q.number} open onOpenChange={(o) => !o && close()} />}
      {dialog?.kind === "revise" && (
        <ReviseDialog id={dialog.q.id} number={dialog.q.number} accepted={dialog.q.status === "accepted"} open onOpenChange={(o) => !o && close()} onDone={() => router.push(`/quotes/${dialog.q.id}/edit`)} />
      )}
    </div>
  )
}

function RowMenu({ q, open }: { q: QuoteSummary; open: (d: Dialog) => void }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = React.useState(false)
  const label = quoteLabel(q.number, q.revision)
  const canConvert = q.status === "draft" || q.status === "sent" || q.status === "accepted"
  const waiting = q.status === "sent" || q.status === "draft"

  async function duplicate() {
    setBusy(true)
    const res = await duplicateQuoteAction(q.id, crypto.randomUUID())
    setBusy(false)
    if (!res.ok) return toast({ title: "Couldn't duplicate", description: res.error, tone: "error" })
    toast({ title: `Copied ${label}`, description: "A new draft with today's date and the next number.", tone: "success" })
    router.push(`/quotes/${res.id}/edit`)
  }

  async function copyLink() {
    if (!q.publicToken || !q.linkActive) return toast({ title: "No live link yet", description: "Open it and use Share to send the link.", duration: 4000 })
    const url = `${window.location.origin}/q/${q.publicToken}`
    await navigator.clipboard.writeText(url).catch(() => {})
    toast({ title: "Link copied", description: url, tone: "success" })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`} disabled={busy} className="text-foreground/70" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {q.status === "draft" ? (
          <DropdownMenuItem render={<Link href={`/quotes/${q.id}/edit`} />}>
            <PencilIcon /> Edit
          </DropdownMenuItem>
        ) : q.status === "sent" || q.status === "accepted" || q.status === "declined" ? (
          <DropdownMenuItem onClick={() => open({ kind: "revise", q })}>
            <PencilIcon /> Revise
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem render={<Link href={`/quotes/${q.id}`} />}>
            <FileTextIcon /> Open
          </DropdownMenuItem>
        )}
        {canConvert && (
          <DropdownMenuItem onClick={() => open({ kind: "convert", q, target: "invoice" })}>
            <FileTextIcon /> Convert to invoice
          </DropdownMenuItem>
        )}
        {canConvert && q.kind === "quote" && (
          <DropdownMenuItem onClick={() => open({ kind: "convert", q, target: "proforma" })}>
            <ScrollTextIcon /> Convert to proforma
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => void duplicate()}>
          <CopyPlusIcon /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href={`/api/quotes/${q.id}/pdf`} download />}>
          <DownloadIcon /> Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copyLink()}>
          {q.publicToken ? <CopyIcon /> : <LinkIcon />} Copy link
        </DropdownMenuItem>
        {waiting && <DropdownMenuSeparator />}
        {waiting && (
          <DropdownMenuItem onClick={() => open({ kind: "mark", q, status: "accepted" })}>
            <CheckIcon /> Mark accepted
          </DropdownMenuItem>
        )}
        {waiting && q.kind === "quote" && (
          <DropdownMenuItem onClick={() => open({ kind: "mark", q, status: "declined" })}>
            <XIcon /> Mark declined
          </DropdownMenuItem>
        )}
        {q.status !== "void" && q.status !== "converted" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => open({ kind: "void", q })}>
              <BanIcon /> Void
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
