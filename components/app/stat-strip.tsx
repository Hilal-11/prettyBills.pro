import Link from "next/link"
import { cn } from "cn"

/**
 * The row of headline numbers across the top of a full-width page
 * (invoices, clients, dashboard): edge to edge, split by hairlines, two
 * across on phones and four on wide screens.
 */
export function StatStrip({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={cn("grid shrink-0 grid-cols-2 border-b lg:grid-cols-4", className)}>
      {children}
    </section>
  )
}

const tileCls =
  "group grid min-w-0 content-start gap-0.5 border-b px-4 py-3 outline-none odd:border-r lg:border-r lg:border-b-0 lg:last:border-r-0 [&:nth-last-child(-n+2)]:border-b-0"

/** One number: label, value (with the exact figure on hover), a note, and an optional trend. Links when given `href`. */
export function StatTile({ href, label, value, full, note, tone, spark }: { href?: string; label: string; value: React.ReactNode; full?: string; note: React.ReactNode; tone?: "danger" | "good"; spark?: React.ReactNode }) {
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-end justify-between gap-3">
        <span title={full} className={cn("truncate text-lg font-semibold tracking-[-0.02em] tabular-nums sm:text-xl", tone === "danger" && "text-red-600 dark:text-red-400", tone === "good" && "text-emerald-700 dark:text-emerald-400")}>
          {value}
        </span>
        {spark && <span className="hidden shrink-0 pb-0.5 sm:block">{spark}</span>}
      </span>
      <span className="truncate text-xs text-muted-foreground">{note}</span>
    </>
  )
  return href ? (
    <Link href={href} className={cn(tileCls, "transition-colors hover:bg-muted/30 focus-visible:bg-muted/40")}>
      {body}
    </Link>
  ) : (
    <div className={tileCls}>{body}</div>
  )
}
