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
}

/** Status pill, the same one the editor shows. Late open invoices read "Overdue". */
export function StatusBadge({ invoice, className }: { invoice: Pick<InvoiceSummary, "status" | "bucket">; className?: string }) {
  const key = invoice.bucket === "overdue" ? "overdue" : invoice.status
  const [label, dot] = STYLE[key] ?? STYLE.draft
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground/85", className)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  )
}
