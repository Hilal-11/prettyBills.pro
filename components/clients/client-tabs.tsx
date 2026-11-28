"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ActivityIcon, FileTextIcon, LayoutGridIcon, ReceiptTextIcon, ScrollTextIcon, WalletIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { spring } from "@/lib/motion"

export type ClientTab = "overview" | "invoices" | "quotes" | "payments" | "statement" | "activity"

const ICON: Record<ClientTab, LucideIcon> = { overview: LayoutGridIcon, invoices: FileTextIcon, quotes: ScrollTextIcon, payments: WalletIcon, statement: ReceiptTextIcon, activity: ActivityIcon }

/** Underlined section tabs on a client's page; the underline glides between them. */
export function ClientTabs({ base, active, tabs }: { base: string; active: ClientTab; tabs: { id: ClientTab; label: string; count?: number }[] }) {
  return (
    <nav aria-label="Client sections" className="sticky top-0 z-20 flex h-11 shrink-0 items-stretch gap-0.5 overflow-x-auto border-b bg-background px-3">
      {tabs.map((t) => {
        const on = t.id === active
        const Icon = ICON[t.id]
        return (
          <Link
            key={t.id}
            href={t.id === "overview" ? base : `${base}?tab=${t.id}`}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cn("relative inline-flex shrink-0 items-center gap-1.5 px-2.5 text-[13px] whitespace-nowrap transition-colors", on ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Icon className="size-3.5" />
            {t.label}
            {t.count !== undefined && <span className="rounded bg-muted px-1 text-[11px] text-muted-foreground tabular-nums">{t.count}</span>}
            {on && <motion.span layoutId="client-tab-line" transition={spring} className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-foreground" />}
          </Link>
        )
      })}
    </nav>
  )
}
