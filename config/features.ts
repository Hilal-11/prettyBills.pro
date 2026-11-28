/**
 * Feature flags for the sidebar and its routes. One place to say what's
 * ready:
 *
 * - "live"   → a normal sidebar link; the route works.
 * - "soon"   → shown greyed out with a "Soon" badge and a tooltip, not
 *              clickable. Opening the URL directly shows the shared
 *              "Coming soon" page.
 * - "hidden" → not in the sidebar at all. The URL also shows "Coming soon".
 *
 * When a feature ships: build its page, then change its status to "live".
 * Nothing else. (Keys match the sidebar item ids in lib/dashboard/data.ts;
 * proxy.ts sends non-live paths to app/(app)/coming-soon/[feature].)
 */
export type FeatureStatus = "live" | "soon" | "hidden"

export type Feature = {
  status: FeatureStatus
  name: string
  /** One line, for the sidebar tooltip and the Coming soon page. */
  description: string
  /** The route it lives at (and everything under it). */
  path?: string
}

export const FEATURES = {
  // live: built and working
  dashboard: { status: "live", name: "Dashboard", description: "What you're owed, what's late and what came in.", path: "/dashboard" },
  invoices: { status: "live", name: "Invoices", description: "Every invoice you've made, with drafts, sent, overdue and paid.", path: "/invoices" },
  clients: { status: "live", name: "Clients", description: "Everyone you bill, what they owe and how they pay.", path: "/clients" },
  templates: { status: "live", name: "Templates", description: "GST-ready invoice designs.", path: "/templates" },
  payments: { status: "live", name: "Payments", description: "Money received against your invoices, with TDS.", path: "/payments" },
  receipts: { status: "live", name: "Receipts", description: "A numbered receipt for every payment.", path: "/receipts" },
  "api-docs": { status: "live", name: "Developer docs", description: "How to build on PrettyBills.", path: "/developers" },
  quotes: { status: "live", name: "Quotes & proforma", description: "Send a quote or proforma, then turn it into an invoice in one click.", path: "/quotes" },

  // soon: shown, not clickable
  "credit-notes": { status: "live", name: "Credit notes", description: "Reduce what a client owes with a numbered GST credit note.", path: "/credit-notes" },
  recurring: { status: "soon", name: "Recurring invoices", description: "Invoices that create and send themselves every month.", path: "/recurring" },

  // hidden: not in the sidebar yet
  reminders: { status: "hidden", name: "Payment reminders", description: "Automatic WhatsApp and email reminders before and after the due date.", path: "/reminders" },
  "payment-links": { status: "hidden", name: "Payment links", description: "Let clients pay an invoice online by UPI or card.", path: "/payment-links" },
  expenses: { status: "hidden", name: "Expenses", description: "Track what you spend, with GST input credit.", path: "/expenses" },
  reports: { status: "hidden", name: "Reports", description: "Sales register, GSTR-1, ageing and TDS reports.", path: "/reports" },
  import: { status: "hidden", name: "Bulk import", description: "Bring in clients, items and invoices from a spreadsheet.", path: "/import" },
  team: { status: "soon", name: "Team members", description: "Invite your CA and team, each with the right permissions.", path: "/team" },
  notifications: { status: "soon", name: "Notifications", description: "Choose what you hear about: payments, quote answers, overdue invoices.", path: "/notifications" },
  languages: { status: "soon", name: "Languages", description: "Invoices and quotes in Hindi and other Indian languages.", path: "/languages" },
  einvoice: { status: "hidden", name: "E-invoicing (IRN)", description: "Generate IRN and QR codes for e-invoices.", path: "/e-invoicing" },
  eway: { status: "hidden", name: "E-way bill", description: "Create e-way bills for goods in transit.", path: "/e-way-bill" },
  inventory: { status: "hidden", name: "Inventory", description: "Stock levels that update as you invoice.", path: "/inventory" },
  "api-keys": { status: "hidden", name: "API keys", description: "Keys for connecting your own tools to PrettyBills.", path: "/api-keys" },
} satisfies Record<string, Feature>

export type FeatureId = keyof typeof FEATURES

const all = FEATURES as Record<string, Feature>

/** A sidebar item's status. Anything not listed is live. */
export const featureStatus = (id: string): FeatureStatus => all[id]?.status ?? "live"

export const featureById = (id: string): (Feature & { id: string }) | null => (all[id] ? { id, ...all[id] } : null)

/** The not-yet-live feature a URL belongs to, if any (the route guard in proxy.ts). */
export function gatedFeature(pathname: string): (Feature & { id: string }) | null {
  for (const [id, f] of Object.entries(all)) {
    if (f.status === "live" || !f.path) continue
    if (pathname === f.path || pathname.startsWith(`${f.path}/`)) return { id, ...f }
  }
  return null
}
