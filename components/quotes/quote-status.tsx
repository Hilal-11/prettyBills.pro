import { cn } from "cn"

import { DISPLAY_LABEL, type QuoteDisplay } from "@/lib/billing/quotes"

const DOT: Record<QuoteDisplay, string> = {
  draft: "bg-muted-foreground/60",
  sent: "bg-sky-500",
  viewed: "bg-violet-500",
  expired: "bg-amber-500",
  accepted: "bg-emerald-500",
  declined: "bg-red-500",
  converted: "bg-teal-500",
  void: "bg-zinc-400",
}

/** The same pill invoices use, with the quote statuses (Expired and Viewed are derived). */
export function QuoteStatusBadge({ display, className }: { display: QuoteDisplay; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground/85", className)}>
      <span className={cn("size-1.5 rounded-full", DOT[display])} />
      {DISPLAY_LABEL[display]}
    </span>
  )
}
