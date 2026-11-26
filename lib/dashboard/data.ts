/**
 * Sidebar navigation. Items with an `href` are clickable; `soon` items are
 * shown (so people know they're coming) but not clickable. `pro` items wear
 * the crown.
 */
import {
  BanknoteIcon,
  BellRingIcon,
  BookOpenIcon,
  ChartColumnIcon,
  FileBadgeIcon,
  FileMinusIcon,
  FileTextIcon,
  FileUpIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  Link2Icon,
  type LucideIcon,
  PackageIcon,
  ReceiptIndianRupeeIcon,
  ReceiptTextIcon,
  RepeatIcon,
  ScrollTextIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
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
  /** Part of PrettyBills Pro: shows a crown. */
  pro?: boolean
  /** Collapsible groups start open unless this is false (they always open on one of their pages). */
  defaultOpen?: boolean
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
        count: "all",
        children: [
          { id: "invoices-all", label: "All invoices", href: "/invoices", count: "all" },
          { id: "invoices-drafts", label: "Drafts", href: "/invoices/drafts", count: "drafts" },
          { id: "invoices-sent", label: "Sent", href: "/invoices/sent", count: "sent" },
          { id: "invoices-overdue", label: "Overdue", href: "/invoices/overdue", count: "overdue", tone: "danger" },
          { id: "invoices-paid", label: "Paid", href: "/invoices/paid", count: "paid" },
        ],
      },
      { id: "quotes", label: "Quotes & proforma", icon: ScrollTextIcon, href: "/quotes" },
      { id: "credit-notes", label: "Credit notes", icon: FileMinusIcon, href: "/credit-notes" },
      { id: "recurring", label: "Recurring invoices", icon: RepeatIcon, href: "/recurring" },
      { id: "clients", label: "Clients", icon: UsersIcon, href: "/clients" },
      { id: "templates", label: "Templates", icon: LayoutTemplateIcon, href: "/templates" },
    ],
  },
  {
    label: "Get paid",
    items: [
      { id: "payments", label: "Payments", icon: BanknoteIcon, href: "/payments" },
      { id: "receipts", label: "Receipts", icon: ReceiptTextIcon, href: "/receipts" },
      { id: "reminders", label: "Payment reminders", icon: BellRingIcon, href: "/reminders", pro: true },
      { id: "payment-links", label: "Payment links", icon: Link2Icon, href: "/payment-links" },
    ],
  },
  {
    label: "Money out",
    items: [{ id: "expenses", label: "Expenses", icon: ReceiptIndianRupeeIcon, href: "/expenses" }],
  },
  {
    label: "Reports",
    items: [
      {
        id: "reports",
        label: "Reports",
        icon: ChartColumnIcon,
        href: "/reports",
        defaultOpen: false,
        children: [
          { id: "reports-sales", label: "Sales register", href: "/reports/sales" },
          { id: "reports-gstr1", label: "GSTR-1", href: "/reports/gstr-1" },
          { id: "reports-ageing", label: "Ageing", href: "/reports/ageing" },
          { id: "reports-tds", label: "TDS", href: "/reports/tds" },
        ],
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "import", label: "Bulk import", icon: FileUpIcon, href: "/import" },
      { id: "team", label: "CA access & team", icon: UserCogIcon, href: "/team" },
    ],
  },
  {
    label: "For bigger businesses",
    items: [
      { id: "einvoice", label: "E-invoicing (IRN)", icon: FileBadgeIcon, href: "/e-invoicing" },
      { id: "eway", label: "E-way bill", icon: TruckIcon, href: "/e-way-bill" },
      { id: "inventory", label: "Inventory", icon: PackageIcon, href: "/inventory" },
    ],
  },
  {
    label: "Developers",
    items: [
      { id: "api-docs", label: "API docs", icon: BookOpenIcon, href: "/developers", external: true },
      { id: "api-keys", label: "API keys", icon: KeyRoundIcon, href: "/api-keys" },
    ],
  },
]
