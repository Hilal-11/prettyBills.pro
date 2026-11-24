/**
 * Mock data for the dashboard UI. Nothing here is wired to a backend yet:
 * it exists so the shell can be designed against realistic content.
 */
import {
  ArrowDownToLineIcon,
  BarChart3Icon,
  BellRingIcon,
  BookOpenIcon,
  BoxIcon,
  CreditCardIcon,
  FileBadgeIcon,
  FileClockIcon,
  FileMinusIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  LinkIcon,
  type LucideIcon,
  PaletteIcon,
  PercentIcon,
  ReceiptIcon,
  RepeatIcon,
  ScrollTextIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  WebhookIcon,
} from "lucide-react"

export type NavItem = {
  id: string
  label: string
  icon: LucideIcon
  /** Count shown on the right. */
  count?: number
  /** Not built yet: shows a "Soon" tag. */
  soon?: boolean
  /** Sub-pages, shown in a collapsible list. */
  children?: { id: string; label: string; count?: number }[]
}

export type NavGroup = { label?: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  {
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboardIcon },
      {
        id: "invoices",
        label: "Invoices",
        icon: FileTextIcon,
        count: 24,
        children: [
          { id: "invoices-all", label: "All invoices", count: 24 },
          { id: "invoices-draft", label: "Drafts", count: 3 },
          { id: "invoices-sent", label: "Sent", count: 9 },
          { id: "invoices-paid", label: "Paid", count: 10 },
          { id: "invoices-overdue", label: "Overdue", count: 2 },
        ],
      },
      { id: "quotes", label: "Quotes", icon: ScrollTextIcon, count: 6 },
      { id: "receipts", label: "Receipts", icon: ReceiptIcon },
      { id: "credit-notes", label: "Credit notes", icon: FileMinusIcon },
      { id: "recurring", label: "Recurring", icon: RepeatIcon, soon: true },
    ],
  },
  {
    label: "Money",
    items: [
      { id: "payments", label: "Payments", icon: WalletIcon },
      { id: "payment-links", label: "Payment links", icon: LinkIcon },
      { id: "reminders", label: "Reminders", icon: BellRingIcon },
      { id: "expenses", label: "Expenses", icon: CreditCardIcon, soon: true },
      { id: "reports", label: "Reports", icon: BarChart3Icon },
    ],
  },
  {
    label: "Customers & catalog",
    items: [
      { id: "clients", label: "Clients", icon: UsersIcon, count: 18 },
      { id: "items", label: "Items & services", icon: BoxIcon },
      { id: "imports", label: "Import data", icon: ArrowDownToLineIcon },
    ],
  },
  {
    label: "GST & compliance",
    items: [
      { id: "gst-summary", label: "GST summary", icon: PercentIcon },
      { id: "gstr1", label: "GSTR-1 export", icon: FileSpreadsheetIcon },
      { id: "einvoice", label: "E-invoicing (IRN)", icon: FileBadgeIcon, soon: true },
      { id: "eway", label: "E-way bills", icon: TruckIcon, soon: true },
      { id: "hsn", label: "HSN / SAC library", icon: BookOpenIcon },
    ],
  },
  {
    label: "Brand",
    items: [
      { id: "templates", label: "Templates", icon: LayoutTemplateIcon },
      { id: "brand-kit", label: "Brand kit", icon: PaletteIcon },
    ],
  },
  {
    label: "Developers",
    items: [
      { id: "api-keys", label: "API keys", icon: KeyRoundIcon },
      { id: "webhooks", label: "Webhooks", icon: WebhookIcon },
      { id: "logs", label: "Activity log", icon: FileClockIcon },
    ],
  },
]

export const workspaces = [
  { id: "rds", name: "Rahul Design Studio", meta: "GSTIN 01ABCDE1234F1Z5", initials: "RD" },
  { id: "chinar", name: "Chinar Crafts", meta: "GSTIN 01FGHIJ5678K1Z2", initials: "CC" },
]

// PLACEHOLDER: fictional signed-in user for the UI.
export const currentUser = {
  name: "Rahul Mir",
  email: "rahul@rahuldesign.studio",
  initials: "RM",
  plan: "Free",
}

/** Seller's state (from the workspace GSTIN). Decides IGST vs CGST + SGST. */
export const sellerStateCode = "01"

export const states = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "03", name: "Punjab" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "19", name: "West Bengal" },
  { code: "24", name: "Gujarat" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "36", name: "Telangana" },
]

// Fictional clients; emails use the reserved .example domain.
export const clients = [
  {
    id: "lakeview",
    name: "Lakeview Café",
    city: "Bengaluru",
    stateCode: "29",
    address: ["80 Feet Road, Indiranagar", "Bengaluru, Karnataka 560038", "India"],
    email: "accounts@lakeviewcafe.example",
  },
  {
    id: "chinar",
    name: "Chinar Crafts",
    city: "Srinagar",
    stateCode: "01",
    address: ["Polo View Market", "Srinagar, Jammu & Kashmir 190001", "India"],
    email: "hello@chinarcrafts.example",
  },
  {
    id: "monsoon",
    name: "Monsoon Media",
    city: "Mumbai",
    stateCode: "27",
    address: ["4th Floor, Kamala Mills", "Mumbai, Maharashtra 400013", "India"],
    email: "finance@monsoonmedia.example",
  },
  {
    id: "saffron",
    name: "Saffron Stays",
    city: "Jaipur",
    stateCode: "08",
    address: ["C-Scheme, Ashok Marg", "Jaipur, Rajasthan 302001", "India"],
    email: "billing@saffronstays.example",
  },
]

export const paymentMethods = ["UPI · GPay", "UPI · PhonePe", "Bank transfer (NEFT)", "Card · Visa", "Cash"]

export const gstRates = [0, 5, 12, 18, 28]

export const editorTemplates: { slug: string; name: string; recommended?: boolean }[] = [
  { slug: "standard", name: "Standard", recommended: true },
  { slug: "minimal-mono", name: "Minimal Mono" },
  { slug: "studio-bold", name: "Studio Bold" },
  { slug: "classic-ledger", name: "Classic Ledger" },
  { slug: "kirana-clean", name: "Kirana Clean" },
  { slug: "frame", name: "Frame" },
  { slug: "cafe-receipt", name: "Café Receipt" },
]
