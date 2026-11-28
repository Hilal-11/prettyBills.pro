/**
 * Sidebar navigation. Whether each item is live, "soon" (shown greyed, not
 * clickable) or hidden comes from config/features.ts, keyed by item id.
 * `pro` items wear the crown.
 */
import {
  BanknoteIcon,
  BellIcon,
  BellRingIcon,
  BookOpenIcon,
  ChartColumnIcon,
  FileBadgeIcon,
  FileMinusIcon,
  FileTextIcon,
  FileUpIcon,
  LanguagesIcon,
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

import { featureById, featureStatus } from "@/config/features"
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
  /** Colours that number red (it needs attention). */
  tone?: "danger"
  /** Not built yet (config/features.ts): shown greyed with a "Soon" tag, not clickable. */
  soon?: boolean
  /** One line about the feature, for the "Soon" tooltip. */
  description?: string
  /** Part of PrettyBills Pro: shows a crown. */
  pro?: boolean
  /** Collapsible groups start open unless this is false (they always open on one of their pages). */
  defaultOpen?: boolean
  children?: NavChild[]
}

export type NavGroup = { label?: string; items: NavItem[] }

const allGroups: NavGroup[] = [
  {
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboardIcon, href: "/dashboard" },
      // one page with tabs (all, drafts, sent, overdue, paid, upcoming); the badge counts what's overdue
      { id: "invoices", label: "Invoices", icon: FileTextIcon, href: "/invoices", count: "overdue", tone: "danger" },
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
    items: [{ id: "import", label: "Bulk import", icon: FileUpIcon, href: "/import" }],
  },
  {
    label: "For bigger businesses",
    items: [
      { id: "einvoice", label: "E-invoicing (IRN)", icon: FileBadgeIcon, href: "/e-invoicing" },
      { id: "eway", label: "E-way bill", icon: TruckIcon, href: "/e-way-bill" },
      { id: "inventory", label: "Inventory", icon: PackageIcon, href: "/inventory" },
    ],
  },
]

/**
 * The links pinned to the bottom of the nav, above Themes and Settings
 * (keyboard shortcuts sits between Languages and Developer docs; it opens a
 * dialog, so the sidebar adds it). Same feature flags as the groups.
 */
const allControls: NavItem[] = [
  { id: "team", label: "Team members", icon: UserCogIcon, href: "/team" },
  { id: "notifications", label: "Notifications", icon: BellIcon, href: "/notifications" },
  { id: "languages", label: "Languages", icon: LanguagesIcon, href: "/languages" },
  { id: "api-docs", label: "Developer docs", icon: BookOpenIcon, href: "/developers", external: true },
]

const withFlags = (items: NavItem[]) =>
  items
    .filter((item) => featureStatus(item.id) !== "hidden")
    .map((item) => (featureStatus(item.id) === "soon" ? { ...item, soon: true, description: featureById(item.id)?.description } : item))

/**
 * What the sidebar (and the ⌘K palette) show: hidden features left out,
 * "soon" ones marked, groups that end up empty dropped.
 */
export const navGroups: NavGroup[] = allGroups.map((g) => ({ ...g, items: withFlags(g.items) })).filter((g) => g.items.length > 0)

/** Bottom-of-nav links, flags applied. */
export const controlItems: NavItem[] = withFlags(allControls)

/** Any sidebar item by id, hidden ones included (the Coming soon page uses its icon). */
export function navItemById(id: string): NavItem | undefined {
  return [...allGroups.flatMap((g) => g.items), ...allControls].find((item) => item.id === id)
}
