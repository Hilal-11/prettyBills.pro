"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import type { LucideIcon } from "lucide-react"
import { cn } from "cn"

import { spring } from "@/lib/motion"

/**
 * The pieces every full-width list page shares (invoices, clients, payments,
 * receipts): the toolbar row, link tabs with counts, and the table cell
 * styles. Same look everywhere, from one place.
 */

/** The row under the page header: tabs on the left, filters and actions on the right. */
export function Toolbar({ tabs, children }: { tabs?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
      {tabs}
      {children && <div className="ml-auto flex flex-wrap items-center gap-1.5">{children}</div>}
    </div>
  )
}

export type PageTab = { id: string; label: string; href: string; count?: number; danger?: boolean }

/** Tabs that are links (so each view has its own URL), with the sliding pill. */
export function PageTabs({ tabs, active, label }: { tabs: PageTab[]; active: string; label: string }) {
  const id = React.useId()
  return (
    <nav aria-label={label} className="-mx-1 max-w-full overflow-x-auto px-1">
      <ul className="flex items-center gap-0.5">
        {tabs.map((t) => {
          const on = t.id === active
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn("relative isolate inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors", on ? "font-medium text-foreground" : "text-foreground/60 hover:text-foreground")}
              >
                {on && <motion.span layoutId={`page-tabs-${id}`} transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-muted/70" />}
                {t.label}
                {t.count !== undefined && <span className={cn("text-xs tabular-nums", t.danger && t.count > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{t.count}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Cell styles. Rows set `--row` so pinned cells keep a solid background on hover. */
export const cell = {
  th: "h-9 border-r border-b border-border/70 bg-background px-3 text-left text-xs font-normal whitespace-nowrap text-muted-foreground",
  td: "h-10 overflow-hidden border-r border-b border-border/50 bg-(--row) px-3 text-ellipsis whitespace-nowrap transition-colors",
  tf: "h-9 border-t border-r border-border/70 bg-background px-3 text-xs",
  row: "group/row [--row:var(--background)] hover:[--row:color-mix(in_oklab,var(--muted)_70%,var(--background))]",
}

/** A header cell with an icon, right-aligned for money. */
export function HeadCell({ icon: Icon, label, right, className, children }: { icon?: LucideIcon; label: string; right?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <th scope="col" className={cn(cell.th, className)}>
      {children ?? (
        <span className={cn("flex items-center gap-1.5", right && "flex-row-reverse")}>
          {Icon && <Icon className="size-3.5 shrink-0 opacity-80" />}
          <span className="truncate">{label}</span>
        </span>
      )}
    </th>
  )
}
