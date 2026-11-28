"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarIcon, FileTextIcon, HashIcon, IndianRupeeIcon, ReceiptTextIcon, UsersIcon, WalletIcon } from "lucide-react"
import { cn } from "cn"

import { cell, HeadCell } from "@/components/app/data-table"
import { ClientChip } from "@/components/invoices/client-chip"
import { formatDate } from "@/lib/billing/dates"
import { MODE_LABEL } from "@/lib/billing/modes"
import { formatINR } from "@/lib/billing/money"
import { tdsLabel } from "@/lib/billing/tds"
import type { PaymentRow } from "@/lib/data/types"

import { ModeIcon } from "./mode-icon"
import { PaymentMenu } from "./payment-menu"

const Muted = ({ children = "—" }: { children?: React.ReactNode }) => <span className="text-muted-foreground/70">{children}</span>

/**
 * The Payments page table, edge to edge like Clients and Invoices: pinned
 * header, row numbers, the client's marker, TDS and settled when any payment
 * here had TDS, and a footer with the totals for everything that matches
 * the filters (not just this page). A row opens its receipt.
 */
export function PaymentsGrid({ payments, totals, offset = 0, footerNote, after }: { payments: PaymentRow[]; totals: { received: number; tds: number; settled: number; count: number }; offset?: number; footerNote?: React.ReactNode; after?: React.ReactNode }) {
  const router = useRouter()
  const tds = totals.tds > 0 || payments.some((p) => p.tdsPaise > 0)
  const cols: [string, number][] = [
    ["#", 40],
    ["date", 104],
    ["client", 170],
    ["invoice", 124],
    ["mode", 124],
    ["reference", 120],
    ["received", 112],
    ...(tds ? ([["tds", 96], ["settled", 112]] as [string, number][]) : []),
    ["receipt", 128],
    ["menu", 44],
  ]
  const minWidth = cols.reduce((s, [, w]) => s + w, 0)

  return (
    <div className="relative min-h-0 flex-1 overflow-auto">
      <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]" style={{ minWidth }}>
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
            <HeadCell icon={CalendarIcon} label="Date" className="sticky left-10 z-10" />
            <HeadCell icon={UsersIcon} label="Client" />
            <HeadCell icon={FileTextIcon} label="Invoice" />
            <HeadCell icon={WalletIcon} label="Mode" />
            <HeadCell icon={HashIcon} label="Reference" />
            <HeadCell icon={IndianRupeeIcon} label="Received" right />
            {tds && (
              <>
                <HeadCell label="TDS" right />
                <HeadCell label="Settled" right />
              </>
            )}
            <HeadCell icon={ReceiptTextIcon} label="Receipt" />
            <th scope="col" className={cn(cell.th, "sticky right-0 z-10 border-r-0")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr
              key={p.id}
              onClick={(e) => {
                const t = e.target as HTMLElement
                if (!e.currentTarget.contains(t) || t.closest("a, button, [data-row-skip]") || window.getSelection()?.toString()) return
                router.push(p.receiptId ? `/receipts/${p.receiptId}` : `/invoices/${p.invoiceId}`)
              }}
              className={cn(cell.row, "cursor-pointer")}
            >
              <td className={cn(cell.td, "sticky left-0 z-[1] px-0 text-center text-xs text-muted-foreground tabular-nums")}>{offset + i + 1}</td>
              <td className={cn(cell.td, "sticky left-10 z-[1] tabular-nums")}>{formatDate(p.paidOn)}</td>
              <td className={cell.td}>
                {p.clientName ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <ClientChip name={p.clientName} />
                    {p.clientId ? (
                      <Link href={`/clients/${encodeURIComponent(p.clientId)}`} className="truncate hover:underline">
                        {p.clientName}
                      </Link>
                    ) : (
                      <span className="truncate">{p.clientName}</span>
                    )}
                  </span>
                ) : (
                  <Muted />
                )}
              </td>
              <td className={cn(cell.td, "tabular-nums")}>
                <Link href={`/invoices/${p.invoiceId}`} className="font-medium hover:underline">
                  {p.invoiceNumber}
                </Link>
              </td>
              <td className={cell.td}>
                <span className="flex items-center gap-1.5">
                  <ModeIcon mode={p.mode} className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{MODE_LABEL[p.mode]}</span>
                </span>
              </td>
              <td className={cn(cell.td, "text-muted-foreground tabular-nums")} title={p.note ?? undefined}>
                {p.reference || <Muted />}
              </td>
              <td className={cn(cell.td, "text-right tabular-nums", tds ? "font-medium" : "font-semibold")}>{formatINR(p.amount)}</td>
              {tds && (
                <>
                  <td className={cn(cell.td, "text-right text-muted-foreground tabular-nums")} title={p.tdsSection ? tdsLabel(p.tdsSection) : undefined}>
                    {p.tdsPaise ? formatINR(p.tdsPaise) : <Muted />}
                  </td>
                  <td className={cn(cell.td, "text-right font-semibold tabular-nums")}>{formatINR(p.amount + p.tdsPaise)}</td>
                </>
              )}
              <td className={cn(cell.td, "tabular-nums")}>
                {p.receiptId ? (
                  <Link href={`/receipts/${p.receiptId}`} className="text-brand hover:underline dark:text-[#6da2ff]">
                    {p.receiptNumber}
                  </Link>
                ) : (
                  <Muted />
                )}
              </td>
              <td className={cn(cell.td, "sticky right-0 z-[1] border-r-0 px-1 text-right")} data-row-skip>
                <PaymentMenu payment={p} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 z-20">
          <tr>
            <td colSpan={2} className={cn(cell.tf, "sticky left-0 z-10 text-muted-foreground")}>
              {totals.count.toLocaleString("en-IN")} payment{totals.count === 1 ? "" : "s"}
            </td>
            <td colSpan={4} className={cn(cell.tf, "text-muted-foreground")}>
              {footerNote}
            </td>
            <td className={cn(cell.tf, "text-right tabular-nums")}>
              <span className="text-muted-foreground">Σ </span>
              <span className="font-medium">{formatINR(totals.received, { decimals: false })}</span>
            </td>
            {tds && (
              <>
                <td className={cn(cell.tf, "text-right tabular-nums")}>
                  <span className="text-muted-foreground">Σ </span>
                  <span className="font-medium">{formatINR(totals.tds, { decimals: false })}</span>
                </td>
                <td className={cn(cell.tf, "text-right tabular-nums")}>
                  <span className="text-muted-foreground">Σ </span>
                  <span className="font-medium">{formatINR(totals.settled, { decimals: false })}</span>
                </td>
              </>
            )}
            <td colSpan={2} className={cn(cell.tf, "border-r-0")} />
          </tr>
        </tfoot>
      </table>
      {after}
    </div>
  )
}
