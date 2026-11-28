import { cn } from "cn"

import type { InvoiceSummary } from "@/lib/data/types"

const STYLE: Record<string, [label: string, dot: string]> = {
  draft: ["Draft", "bg-muted-foreground/60"],
  sent: ["Sent", "bg-sky-500"],
  viewed: ["Viewed", "bg-violet-500"],
  partially_paid: ["Part paid", "bg-teal-500"],
  paid: ["Paid", "bg-emerald-500"],
  overdue: ["Overdue", "bg-red-500"],
  void: ["Void", "bg-zinc-400"],
  cancelled: ["Cancelled", "bg-zinc-400"],
  credited: ["Credited", "bg-violet-500"],
}

/** Status pill, the same one the editor shows. Late open invoices read "Overdue". */
export function StatusBadge({ invoice, className }: { invoice: Pick<InvoiceSummary, "status" | "bucket"> & Partial<Pick<InvoiceSummary, "cancelled" | "creditedPaise" | "amountPaid">>; className?: string }) {
  // credit notes: fully cancelled, or settled by credit alone with no payments
  const key = invoice.cancelled
    ? "cancelled"
    : invoice.status === "paid" && (invoice.creditedPaise ?? 0) > 0 && !(invoice.amountPaid ?? 0)
      ? "credited"
      : invoice.bucket === "overdue"
        ? "overdue"
        : invoice.status
  const [label, dot] = STYLE[key] ?? STYLE.draft
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground/85", className)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  )
}
