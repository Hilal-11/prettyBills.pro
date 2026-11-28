"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDownIcon, CalendarIcon, CircleDotIcon, FileTextIcon, IndianRupeeIcon, ReceiptTextIcon, UsersIcon, WalletIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { cell, HeadCell } from "@/components/app/data-table"
import { ClientChip } from "@/components/invoices/client-chip"
import { ModeIcon } from "@/components/payments/mode-icon"
import { formatDate } from "@/lib/billing/dates"
import { MODE_LABEL } from "@/lib/billing/modes"
import { formatINR } from "@/lib/billing/money"
import { tdsLabel } from "@/lib/billing/tds"
import type { ReceiptRow } from "@/lib/data/types"

import { ReceiptMenu, ReceiptStatus } from "./receipts-table"

const Muted = ({ children = "—" }: { children?: React.ReactNode }) => <span className="text-muted-foreground/70">{children}</span>

/**
 * The Receipts page table, edge to edge like Clients: pinned receipt
 * number, client marker, received and TDS, status, the row menu. "Date"
 * and "Received" headers sort (newest first / biggest first). A row opens
 * the receipt.
 */
export function ReceiptsGrid({ receipts, sort, sortHrefs, after }: { receipts: ReceiptRow[]; sort: "date" | "amount"; sortHrefs: Record<"date" | "amount", string>; after?: React.ReactNode }) {
  const router = useRouter()
  const tds = receipts.some((r) => r.tdsPaise > 0)
  const cols: [string, number][] = [
    ["#", 44],
    ["number", 150],
    ["date", 120],
    ["client", 190],
    ["invoice", 140],
    ["mode", 150],
    ["received", 124],
    ...(tds ? ([["tds", 108]] as [string, number][]) : []),
    ["status", 104],
    ["menu", 44],
  ]
  const shown = receipts.filter((r) => r.status === "active")
  const received = shown.reduce((s, r) => s + r.amount, 0)
  const tdsTotal = shown.reduce((s, r) => s + r.tdsPaise, 0)

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
            <HeadCell icon={ReceiptTextIcon} label="Receipt" className="sticky left-11 z-10" />
            <SortHead by="date" icon={CalendarIcon} label="Date" sort={sort} href={sortHrefs.date} />
            <HeadCell icon={UsersIcon} label="Client" />
            <HeadCell icon={FileTextIcon} label="Invoice" />
            <HeadCell icon={WalletIcon} label="Mode" />
            <SortHead by="amount" icon={IndianRupeeIcon} label="Received" right sort={sort} href={sortHrefs.amount} />
            {tds && <HeadCell label="TDS" right />}
            <HeadCell icon={CircleDotIcon} label="Status" />
            <th scope="col" className={cn(cell.th, "sticky right-0 z-10 border-r-0")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r, i) => {
            const voided = r.status === "void"
            return (
              <tr
                key={r.id}
                onClick={(e) => {
                  const t = e.target as HTMLElement
                  if (!e.currentTarget.contains(t) || t.closest("a, button, [data-row-skip]") || window.getSelection()?.toString()) return
                  router.push(`/receipts/${r.id}`)
                }}
                className={cn(cell.row, "cursor-pointer", voided && "text-muted-foreground")}
              >
                <td className={cn(cell.td, "sticky left-0 z-[1] px-0 text-center text-xs text-muted-foreground tabular-nums")}>{i + 1}</td>
                <td className={cn(cell.td, "sticky left-11 z-[1] tabular-nums")}>
                  <Link href={`/receipts/${r.id}`} className={cn("font-medium hover:underline", voided && "line-through decoration-muted-foreground/50")}>
                    {r.number}
                  </Link>
                </td>
                <td className={cn(cell.td, "tabular-nums")}>{formatDate(r.date)}</td>
                <td className={cell.td}>
                  {r.clientName ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <ClientChip name={r.clientName} />
                      <span className="truncate">{r.clientName}</span>
                    </span>
                  ) : (
                    <Muted />
                  )}
                </td>
                <td className={cn(cell.td, "tabular-nums")}>
                  <Link href={`/invoices/${r.invoiceId}`} className="hover:underline">
                    {r.invoiceNumber}
                  </Link>
                </td>
                <td className={cell.td}>
                  <span className="flex items-center gap-1.5">
                    <ModeIcon mode={r.mode} className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{MODE_LABEL[r.mode]}</span>
                  </span>
                </td>
                <td className={cn(cell.td, "text-right font-semibold tabular-nums", voided && "font-normal line-through")}>{formatINR(r.amount)}</td>
                {tds && (
                  <td className={cn(cell.td, "text-right text-muted-foreground tabular-nums", voided && "line-through")} title={r.tdsSection ? tdsLabel(r.tdsSection) : undefined}>
                    {r.tdsPaise ? formatINR(r.tdsPaise) : <Muted />}
                  </td>
                )}
                <td className={cell.td}>
                  <ReceiptStatus status={r.status} />
                </td>
                <td className={cn(cell.td, "sticky right-0 z-[1] border-r-0 px-1 text-right")} data-row-skip>
                  <ReceiptMenu receipt={r} />
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="sticky bottom-0 z-20">
          <tr>
            <td colSpan={2} className={cn(cell.tf, "sticky left-0 z-10 text-muted-foreground")}>
              {receipts.length.toLocaleString("en-IN")} shown
            </td>
            <td colSpan={4} className={cn(cell.tf, "text-muted-foreground")}>
              {shown.length !== receipts.length ? `Totals count the ${shown.length} active receipts` : null}
            </td>
            <td className={cn(cell.tf, "text-right tabular-nums")}>
              <span className="text-muted-foreground">Σ </span>
              <span className="font-medium">{formatINR(received, { decimals: false })}</span>
            </td>
            {tds && (
              <td className={cn(cell.tf, "text-right tabular-nums")}>
                <span className="text-muted-foreground">Σ </span>
                <span className="font-medium">{formatINR(tdsTotal, { decimals: false })}</span>
              </td>
            )}
            <td colSpan={2} className={cn(cell.tf, "border-r-0")} />
          </tr>
        </tfoot>
      </table>
      {after}
    </div>
  )
}

function SortHead({ by, icon: Icon, label, right, sort, href }: { by: "date" | "amount"; icon: LucideIcon; label: string; right?: boolean; sort: "date" | "amount"; href: string }) {
  return (
    <HeadCell label={label}>
      <Link href={href} scroll={false} aria-label={`Sort by ${label.toLowerCase()}`} className={cn("-mx-1 flex items-center gap-1.5 rounded px-1 py-1 transition-colors hover:text-foreground", right && "flex-row-reverse", sort === by && "text-foreground")}>
        <Icon className="size-3.5 shrink-0 opacity-80" />
        <span className="truncate">{label}</span>
        {sort === by && <ArrowDownIcon className="size-3 shrink-0" />}
      </Link>
    </HeadCell>
  )
}
