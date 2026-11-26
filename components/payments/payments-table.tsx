"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { formatDate } from "@/lib/billing/dates"
import { MODE_LABEL } from "@/lib/billing/modes"
import { formatINR } from "@/lib/billing/money"
import type { PaymentRow } from "@/lib/data/types"

import { ModeIcon } from "./mode-icon"
import { PaymentMenu } from "./payment-menu"

/**
 * Payments as a table: date, client, invoice, mode, reference, amount,
 * receipt. Same look as the invoice list. Columns can be dropped where the
 * page already says them (a client's own page has no Client column).
 */
export function PaymentsTable({ payments, showClient = true, showInvoice = true }: { payments: PaymentRow[]; showClient?: boolean; showInvoice?: boolean }) {
  const cols = ["7.5rem", ...(showClient ? ["minmax(0,1.4fr)"] : []), ...(showInvoice ? ["minmax(0,1fr)"] : []), "8.5rem", "minmax(0,1fr)", "8rem", "minmax(0,1fr)", "2.5rem"].join(" ")
  const headers = ["Date", ...(showClient ? ["Client"] : []), ...(showInvoice ? ["Invoice"] : []), "Mode", "Reference", "Amount", "Receipt", ""]
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="hidden gap-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid" style={{ gridTemplateColumns: cols }}>
        {headers.map((h, i) => (
          <span key={`${h}${i}`} className={cn(h === "Amount" && "text-right")}>
            {h}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {payments.map((p) => (
          <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/40 md:gap-4 md:[grid-template-columns:var(--cols)]" style={{ "--cols": cols } as React.CSSProperties}>
            {/* desktop */}
            <span className="hidden tabular-nums md:block">{formatDate(p.paidOn)}</span>
            {showClient && <span className="hidden truncate md:block">{p.clientId ? <Link href={`/clients/${p.clientId}`} className="hover:underline">{p.clientName || "—"}</Link> : p.clientName || "—"}</span>}
            {showInvoice && (
              <Link href={`/invoices/${p.invoiceId}`} className="hidden truncate font-medium tabular-nums hover:underline md:block">
                {p.invoiceNumber}
              </Link>
            )}
            <span className="hidden items-center gap-1.5 text-foreground/85 md:flex">
              <ModeIcon mode={p.mode} className="size-3.5 text-muted-foreground" /> {MODE_LABEL[p.mode]}
            </span>
            <span className="hidden truncate text-muted-foreground tabular-nums md:block" title={p.note ?? undefined}>
              {p.reference || "—"}
            </span>
            <span className="hidden text-right font-semibold tabular-nums md:block">{formatINR(p.amount)}</span>
            <span className="hidden truncate tabular-nums md:block">
              {p.receiptId ? (
                <Link href={`/receipts/${p.receiptId}`} className="text-brand hover:underline dark:text-[#6da2ff]">
                  {p.receiptNumber}
                </Link>
              ) : (
                "—"
              )}
            </span>

            {/* phone */}
            <span className="grid min-w-0 md:hidden">
              <span className="truncate font-medium">{showClient ? p.clientName || p.invoiceNumber : p.invoiceNumber}</span>
              <span className="truncate text-xs text-muted-foreground tabular-nums">
                {formatDate(p.paidOn)} · {MODE_LABEL[p.mode]}
                {p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
              </span>
            </span>
            <span className="text-right font-semibold tabular-nums md:hidden">{formatINR(p.amount)}</span>

            <span className="flex justify-end">
              <PaymentMenu payment={p} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
