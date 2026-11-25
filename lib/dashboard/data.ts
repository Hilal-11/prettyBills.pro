/**
 * Sidebar navigation. Items with an `href` are real pages; `soon` items are
 * shown (so people know they're coming) but not clickable.
 */
import {
  BookOpenIcon,
  BoxIcon,
  FileBadgeIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  type LucideIcon,
  RepeatIcon,
  ScrollTextIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import type { Overview } from "@/lib/data/types"

export type NavChild = { id: string; label: string; href: string; count?: keyof Overview; tone?: "danger" }

export type NavItem = {
  id: string
  label: string
  icon: LucideIcon
  href?: string
  /** Opens outside the app (new tab). */
  external?: boolean
  /** Overview key whose number shows on the right. */
  count?: keyof Overview
  /** Not built yet: shows a "Soon" tag. */
  soon?: boolean
  children?: NavChild[]
}

export type NavGroup = { label?: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  {
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboardIcon, href: "/dashboard" },
      {
        id: "invoices",
        label: "Invoices",
        icon: FileTextIcon,
        href: "/invoices",
        children: [
          { id: "invoices-all", label: "All invoices", href: "/invoices", count: "all" },
          { id: "invoices-drafts", label: "Drafts", href: "/invoices/drafts", count: "drafts" },
          { id: "invoices-sent", label: "Sent", href: "/invoices/sent", count: "sent" },
          { id: "invoices-overdue", label: "Overdue", href: "/invoices/overdue", count: "overdue", tone: "danger" },
          { id: "invoices-paid", label: "Paid", href: "/invoices/paid", count: "paid" },
        ],
      },
      { id: "clients", label: "Clients", icon: UsersIcon, href: "/clients" },
      { id: "items", label: "Items & services", icon: BoxIcon, href: "/items" },
      { id: "templates", label: "Templates", icon: LayoutTemplateIcon, href: "/templates" },
    ],
  },
  {
    label: "Coming soon",
    items: [
      { id: "quotes", label: "Quotes", icon: ScrollTextIcon, soon: true },
      { id: "recurring", label: "Recurring invoices", icon: RepeatIcon, soon: true },
      { id: "payments", label: "Online payments", icon: WalletIcon, soon: true },
      { id: "gstr1", label: "GSTR-1 export", icon: FileSpreadsheetIcon, soon: true },
      { id: "einvoice", label: "E-invoicing (IRN)", icon: FileBadgeIcon, soon: true },
    ],
  },
  {
    label: "Developers",
    items: [
      { id: "api-docs", label: "API docs", icon: BookOpenIcon, href: "/developers", external: true },
      { id: "api-keys", label: "API keys", icon: KeyRoundIcon, soon: true },
    ],
  },
]
