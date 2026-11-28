"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarIcon, CircleDotIcon, FileMinusIcon, FileTextIcon, IndianRupeeIcon, MessageSquareTextIcon, UsersIcon, WalletIcon } from "lucide-react"
import { cn } from "cn"

import { cell, HeadCell } from "@/components/app/data-table"
import { ClientChip } from "@/components/invoices/client-chip"
import { reasonLabel } from "@/lib/billing/credit-notes"
import { formatDate } from "@/lib/billing/dates"
import { formatINR } from "@/lib/billing/money"
import type { CreditNote } from "@/lib/server/db/credit-notes"

import { CreditNoteStatus } from "./credit-note-panel"

/** The Credit notes table, edge to edge like Receipts. A row opens the note (a draft opens the editor). */
export function CreditNotesGrid({ notes, offset = 0, after }: { notes: CreditNote[]; offset?: number; after?: React.ReactNode }) {
  const router = useRouter()
  const cols: [string, number][] = [
    ["#", 40],
    ["number", 140],
    ["date", 112],
    ["client", 180],
    ["invoice", 140],
    ["reason", 200],
    ["amount", 120],
    ["unapplied", 120],
    ["status", 140],
  ]
  const live = notes.filter((n) => n.status === "issued")
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
            <HeadCell icon={FileMinusIcon} label="CN no." className="sticky left-10 z-10" />
            <HeadCell icon={CalendarIcon} label="Date" />
            <HeadCell icon={UsersIcon} label="Client" />
            <HeadCell icon={FileTextIcon} label="Against invoice" />
            <HeadCell icon={MessageSquareTextIcon} label="Reason" />
            <HeadCell icon={IndianRupeeIcon} label="Amount" right />
            <HeadCell icon={WalletIcon} label="Unapplied" right />
            <HeadCell icon={CircleDotIcon} label="Status" className="border-r-0" />
          </tr>
        </thead>
        <tbody>
          {notes.map((n, i) => (
            <tr
              key={n.id}
              onClick={(e) => {
                const t = e.target as HTMLElement
                if (t.closest("a, button") || window.getSelection()?.toString()) return
                router.push(`/credit-notes/${n.id}`)
              }}
              className={cn(cell.row, "cursor-pointer", n.status === "void" && "text-muted-foreground")}
            >
              <td className={cn(cell.td, "sticky left-0 z-[1] px-0 text-center text-xs text-muted-foreground tabular-nums")}>{offset + i + 1}</td>
              <td className={cn(cell.td, "sticky left-10 z-[1] tabular-nums")}>
                <Link href={`/credit-notes/${n.id}`} className={cn("font-medium hover:underline", n.status === "void" && "line-through")}>
                  {n.number ?? "Draft"}
                </Link>
              </td>
              <td className={cn(cell.td, "tabular-nums")}>{formatDate(n.date)}</td>
              <td className={cell.td}>
                <span className="flex min-w-0 items-center gap-2">
                  <ClientChip name={n.clientName} />
                  <span className="truncate">{n.clientName || "—"}</span>
                </span>
              </td>
              <td className={cn(cell.td, "tabular-nums")}>
                <Link href={`/invoices/${n.invoiceId}`} className="hover:underline">
                  {n.invoiceNumber}
                </Link>
              </td>
              <td className={cell.td} title={n.reasonText ?? undefined}>
                {reasonLabel(n.reason)}
              </td>
              <td className={cn(cell.td, "text-right font-semibold tabular-nums", n.status === "void" && "font-normal line-through")}>{formatINR(n.total)}</td>
              <td className={cn(cell.td, "text-right tabular-nums", n.status === "issued" && n.unapplied > 0 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground/70")}>{n.status === "issued" && n.unapplied > 0 ? formatINR(n.unapplied) : "—"}</td>
              <td className={cn(cell.td, "border-r-0")}>
                <CreditNoteStatus note={n} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 z-20">
          <tr>
            <td colSpan={6} className={cn(cell.tf, "sticky left-0 z-10 text-muted-foreground")}>
              {notes.length} shown{live.length !== notes.length ? ` · totals count the ${live.length} issued` : ""}
            </td>
            <td className={cn(cell.tf, "text-right tabular-nums")}>
              <span className="text-muted-foreground">Σ </span>
              <span className="font-medium">{formatINR(live.reduce((s, n) => s + n.total, 0), { decimals: false })}</span>
            </td>
            <td className={cn(cell.tf, "text-right tabular-nums")}>
              <span className="text-muted-foreground">Σ </span>
              <span className="font-medium">{formatINR(live.reduce((s, n) => s + n.unapplied, 0), { decimals: false })}</span>
            </td>
            <td className={cn(cell.tf, "border-r-0")} />
          </tr>
        </tfoot>
      </table>
      {after}
    </div>
  )
}
