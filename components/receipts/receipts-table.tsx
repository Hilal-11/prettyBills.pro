"use client"

import * as React from "react"
import Link from "next/link"
import { DownloadIcon, EyeIcon, LinkIcon, LoaderCircleIcon, MailIcon, MoreHorizontalIcon } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { ModeIcon } from "@/components/payments/mode-icon"
import { useReceiptActions } from "@/components/payments/use-receipt-actions"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDate } from "@/lib/billing/dates"
import { MODE_LABEL } from "@/lib/billing/modes"
import { formatINR } from "@/lib/billing/money"
import type { ReceiptRow } from "@/lib/data/types"

const COLS = "minmax(0,1.1fr) 7rem minmax(0,1.3fr) minmax(0,1fr) 8rem 8rem 5.5rem 2.5rem"
const item = "gap-2 py-1.5 text-[13px]"

export function ReceiptsTable({ receipts }: { receipts: ReceiptRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="hidden gap-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid" style={{ gridTemplateColumns: COLS }}>
        {["Receipt no.", "Date", "Client", "Invoice", "Mode", "Amount", "Status", ""].map((h, i) => (
          <span key={`${h}${i}`} className={cn(h === "Amount" && "text-right")}>
            {h}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {receipts.map((r) => (
          <li key={r.id} className="group relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/40 md:gap-4 md:[grid-template-columns:var(--cols)]" style={{ "--cols": COLS } as React.CSSProperties}>
            <Link href={`/receipts/${r.id}`} className="min-w-0 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset">
              <span className={cn("block truncate font-semibold tabular-nums", r.status === "void" && "text-muted-foreground line-through decoration-muted-foreground/50")}>{r.number}</span>
              <span className="block truncate text-xs text-muted-foreground md:hidden">
                {formatDate(r.date)} · {r.clientName || "—"}
              </span>
            </Link>
            <span className="hidden tabular-nums md:block">{formatDate(r.date)}</span>
            <span className="hidden truncate md:block">{r.clientName || "—"}</span>
            <span className="hidden truncate tabular-nums md:block">{r.invoiceNumber}</span>
            <span className="hidden items-center gap-1.5 text-foreground/85 md:flex">
              <ModeIcon mode={r.mode} className="size-3.5 text-muted-foreground" /> {MODE_LABEL[r.mode]}
            </span>
            <span className={cn("text-right font-semibold tabular-nums", r.status === "void" && "text-muted-foreground line-through")}>{formatINR(r.amount)}</span>
            <span className="hidden md:block">
              <ReceiptStatus status={r.status} />
            </span>
            <span className="relative z-10 flex justify-end">
              <ReceiptMenu receipt={r} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ReceiptStatus({ status, className }: { status: "active" | "void"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/85", status === "void" && "text-muted-foreground line-through", className)}>
      <span className={cn("size-1.5 rounded-full", status === "void" ? "bg-zinc-400" : "bg-emerald-500")} />
      {status === "void" ? "Void" : "Active"}
    </span>
  )
}

function ReceiptMenu({ receipt }: { receipt: ReceiptRow }) {
  const a = useReceiptActions()
  const active = receipt.status === "active"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for receipt ${receipt.number}`} className="text-foreground/70" disabled={!!a.busy} />}>
        {a.busy ? <LoaderCircleIcon className="animate-spin" /> : <MoreHorizontalIcon />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuItem className={item} render={<Link href={`/receipts/${receipt.id}`} />}>
            <EyeIcon /> View
          </DropdownMenuItem>
          <DropdownMenuItem className={item} render={<a href={`/api/receipts/${receipt.id}/pdf`} download />}>
            <DownloadIcon /> Download PDF
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className={item} onClick={() => void a.whatsapp(receipt.id)}>
                <FaWhatsapp /> Share on WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onClick={() => void a.email(receipt.id)}>
                <MailIcon /> Email
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onClick={() => void a.copy(receipt.id)}>
                <LinkIcon /> Copy link
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
