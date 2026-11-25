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

/** Everything the editor needs to start, in one request. */
export type Workspace = {
  settings: WorkspaceSettings
  clients: Client[]
  items: CatalogItem[]
  /** Numbers already used, for the next number and the duplicate check. */
  numbers: { id: string; number: string }[]
}

export type ClientWithStats = Client & {
  invoices: number
  billed: number
  outstanding: number
  overdue: number
  lastInvoiceDate: string | null
  updatedAt: string
}

export type ItemRow = CatalogItem & { updatedAt: string }

export type InvoiceEvent = { type: "created" | "sent" | "viewed" | "downloaded" | "paid" | "reminded" | "voided"; at: string }
