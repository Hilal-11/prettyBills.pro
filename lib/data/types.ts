/**
 * Shapes the server sends to pages and client components. Kept free of
 * runtime imports so both sides can use them.
 */
import type { CatalogItem, Client } from "@/lib/invoice/defaults"
import type { BusinessSnapshot, Invoice, InvoiceStatus, Signature } from "@/lib/invoice/types"

/** Where an invoice sits in the app. Every invoice is in exactly one bucket (void sits under "all" only). */
export type InvoiceBucket = "draft" | "sent" | "overdue" | "paid" | "void"

/** One row in an invoice list: no document, just what lists show. */
export type InvoiceSummary = {
  id: string
  number: string
  status: Exclude<InvoiceStatus, "overdue">
  bucket: InvoiceBucket
  clientId: string | null
  clientName: string
  issueDate: string
  dueDate: string | null
  currency: string
  total: number
  amountPaid: number
  balanceDue: number
  missingFields: number
  templateId: string | null
  publicToken: string | null
  linkActive: boolean
  sentAt: string | null
  viewedAt: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
  /** Positive when overdue, negative while still due, null without a due date. */
  daysPastDue: number | null
}

export type Overview = {
  all: number
  drafts: number
  draftsReady: number
  sent: number
  overdue: number
  paid: number
  outstanding: number
  overdueAmount: number
  collectedMonth: number
  invoicedMonth: number
  invoicedMonthCount: number
  /** Open invoices with money still owed. */
  outstandingCount: number
  oldestOverdueDays: number
  collectedLastMonth: number
  /** Mean days from issue to paid in full, over invoices paid in the last 90 days. Null with no data. */
  avgDaysToPay: number | null
  avgDaysSample: number
}

export const EMPTY_OVERVIEW: Overview = {
  all: 0,
  drafts: 0,
  draftsReady: 0,
  sent: 0,
  overdue: 0,
  paid: 0,
  outstanding: 0,
  overdueAmount: 0,
  collectedMonth: 0,
  invoicedMonth: 0,
  invoicedMonthCount: 0,
  outstandingCount: 0,
  oldestOverdueDays: 0,
  collectedLastMonth: 0,
  avgDaysToPay: null,
  avgDaysSample: 0,
}

export type PaymentDefaults = Omit<Invoice["payment"], "amountPaid">

/** Defaults every new invoice starts with. */
export type WorkspaceSettings = {
  business: (BusinessSnapshot & { id?: string }) | null
  payment: PaymentDefaults | null
  terms: string | null
  signature: Signature | null
}

export const EMPTY_SETTINGS: WorkspaceSettings = { business: null, payment: null, terms: null, signature: null }

/** The user's plan as the UI needs it. */
export type PlanSummary = {
  id: "free" | "pro_monthly" | "pro_yearly"
  pro: boolean
  renewsAt: string | null
  cancelAtPeriodEnd: boolean
  /** Invoice emails this month; limit 0 = emailing isn't in the plan. */
  emails: { used: number; limit: number }
}

/** Everything the editor needs to start, in one request. */
export type Workspace = {
  settings: WorkspaceSettings
  plan: PlanSummary
  clients: Client[]
  items: CatalogItem[]
  /** Numbers already used, for the next number and the duplicate check. */
  numbers: { id: string; number: string }[]
}

export type ClientWithStats = Client & {
  invoices: number
  billed: number
  received: number
  outstanding: number
  overdue: number
  lastInvoiceDate: string | null
  updatedAt: string
}

export type ItemRow = CatalogItem & { updatedAt: string }

export type InvoiceEvent = { type: "created" | "sent" | "viewed" | "downloaded" | "paid" | "reminded" | "voided"; at: string }

/* ------------------------------- payments ------------------------------ */

export type PaymentModeId = "upi" | "cash" | "bank_transfer" | "cheque" | "card" | "other"

/** A payment as lists show it, with its invoice and receipt. */
export type PaymentRow = {
  id: string
  invoiceId: string
  invoiceNumber: string
  invoiceDate: string
  invoiceTotal: number
  clientId: string | null
  clientName: string
  clientGstin: string | null
  amount: number
  paidOn: string
  mode: PaymentModeId
  reference: string | null
  note: string | null
  createdAt: string
  createdBy: string | null
  receiptId: string | null
  receiptNumber: string | null
  receiptStatus: "active" | "void" | null
  receiptRevision: number
  receiptEmailedAt: string | null
}

export type ReceiptRow = {
  id: string
  number: string
  date: string
  revision: number
  status: "active" | "void"
  publicToken: string
  linkActive: boolean
  emailedAt: string | null
  emailCount: number
  voidReason: string | null
  invoiceId: string
  invoiceNumber: string
  clientId: string | null
  clientName: string
  paymentId: string
  amount: number
  mode: PaymentModeId
  reference: string | null
}

/** Everything a receipt document needs. Balance figures are worked out when it's shown. */
export type ReceiptView = {
  receipt: { id: string; number: string; date: string; revision: number; status: "active" | "void"; voidReason: string | null; publicToken?: string; linkActive?: boolean; emailedAt?: string | null; templateId: string; pageColor: "white" | "black" }
  payment: { id: string; amount: number; paidOn: string; mode: PaymentModeId; reference: string | null; note?: string | null }
  invoice: Invoice
  /** Shared receipts: the invoice's public link, when it's on. */
  invoiceLink?: string | null
  balance: { total: number; paidBefore: number; thisPayment: number; remaining: number; paidInFull: boolean }
}

/** What the server hands back after a payment is recorded, edited or deleted. */
export type PaymentResult = {
  payment: { id: string; amount: number; paidOn: string; mode: PaymentModeId; reference: string | null; note: string | null; deletedAt: string | null }
  receipt: { id: string; number: string; revision: number; status: "active" | "void"; publicToken: string; emailedAt: string | null }
  invoice: { id: string; number: string; total: number; amountPaid: number; balanceDue: number; status: Exclude<InvoiceStatus, "overdue">; paidAt: string | null }
  replayed?: boolean
}

/** One line in a timeline: invoice events and payment activity together. */
export type ActivityItem = {
  id: string
  at: string
  action: string
  invoiceId: string | null
  invoiceNumber?: string
  clientName?: string
  data: Record<string, unknown>
  /** Who did it: "you", or null for the client / the system. */
  actor: "you" | null
}
