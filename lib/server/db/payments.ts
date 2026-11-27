import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { receiptBalance } from "@/lib/billing/ledger"
import type { PaymentMode } from "@/lib/billing/modes"
import type { PaymentInput, PaymentUpdate } from "@/lib/billing/validation"
import type { ActivityItem, PaymentResult, PaymentRow, ReceiptRow, ReceiptView } from "@/lib/data/types"
import type { Invoice } from "@/lib/invoice/types"

import { DbError } from "./util"

/**
 * Payments and receipts. Every write is one call to a Postgres function
 * (record_payment, update_payment, delete_payment) that checks ownership,
 * locks the invoice and keeps the invoice, payment and receipt in step in a
 * single transaction. Reads go through RLS like everything else.
 */

/* -------------------------------- writes ------------------------------- */

type RawResult = {
  payment: { id: string; amount_paise: number; paid_on: string; mode: PaymentMode; reference: string | null; note: string | null; deleted_at: string | null }
  receipt: { id: string; number: string; revision: number; status: "active" | "void"; public_token: string; emailed_at: string | null }
  invoice: { id: string; number: string; total: number; amount_paid: number; balance_due: number; status: PaymentResult["invoice"]["status"]; paid_at: string | null }
  replayed?: boolean
}

function toResult(r: RawResult): PaymentResult {
  return {
    payment: { id: r.payment.id, amount: Number(r.payment.amount_paise), paidOn: r.payment.paid_on, mode: r.payment.mode, reference: r.payment.reference, note: r.payment.note, deletedAt: r.payment.deleted_at },
    receipt: { id: r.receipt.id, number: r.receipt.number, revision: r.receipt.revision, status: r.receipt.status, publicToken: r.receipt.public_token, emailedAt: r.receipt.emailed_at },
    invoice: { id: r.invoice.id, number: r.invoice.number, total: Number(r.invoice.total), amountPaid: Number(r.invoice.amount_paid), balanceDue: Number(r.invoice.balance_due), status: r.invoice.status, paidAt: r.invoice.paid_at },
    replayed: r.replayed,
  }
}

async function call(db: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw new DbError(error)
  return toResult(data as RawResult)
}

export function recordPayment(db: SupabaseClient, p: PaymentInput) {
  return call(db, "record_payment", {
    p_invoice_id: p.invoiceId,
    p_amount_paise: p.amountPaise,
    p_paid_on: p.paidOn,
    p_mode: p.mode,
    p_reference: p.reference ?? null,
    p_note: p.note ?? null,
    p_idempotency_key: p.idempotencyKey,
  })
}

export function updatePayment(db: SupabaseClient, p: PaymentUpdate) {
  return call(db, "update_payment", { p_payment_id: p.paymentId, p_amount_paise: p.amountPaise, p_paid_on: p.paidOn, p_mode: p.mode, p_reference: p.reference ?? null, p_note: p.note ?? null })
}

export function deletePayment(db: SupabaseClient, paymentId: string, reason: string) {
  return call(db, "delete_payment", { p_payment_id: paymentId, p_reason: reason })
}

/** Receipt emailed / email failed / shared, for the activity log. */
export async function noteReceiptEvent(db: SupabaseClient, receiptId: string, action: "receipt.emailed" | "receipt.email_failed" | "receipt.shared", data: Record<string, unknown> = {}) {
  const { error } = await db.rpc("note_receipt_event", { p_receipt_id: receiptId, p_action: action, p_data: data })
  if (error) console.warn(`[payments] couldn't note ${action}: ${error.message}`)
}

export async function noteExport(db: SupabaseClient, action: "payments.exported" | "statement.exported", data: Record<string, unknown>) {
  const { error } = await db.rpc("note_export", { p_action: action, p_data: data })
  if (error) console.warn(`[payments] couldn't note ${action}: ${error.message}`)
}

/* -------------------------------- reads -------------------------------- */

const PAYMENT_COLUMNS =
  "id, invoice_id, invoice_number, invoice_date, invoice_total, client_id, client_name, client_gstin, amount_paise, paid_on, mode, reference, note, created_at, created_by, receipt_id, receipt_number, receipt_status, receipt_revision, receipt_emailed_at"

type PaymentDbRow = {
  id: string
  invoice_id: string
  invoice_number: string
  invoice_date: string
  invoice_total: number
  client_id: string | null
  client_name: string
  client_gstin: string | null
  amount_paise: number
  paid_on: string
  mode: PaymentMode
  reference: string | null
  note: string | null
  created_at: string
  created_by: string | null
  receipt_id: string | null
  receipt_number: string | null
  receipt_status: "active" | "void" | null
  receipt_revision: number | null
  receipt_emailed_at: string | null
}

const toPayment = (r: PaymentDbRow): PaymentRow => ({
  id: r.id,
  invoiceId: r.invoice_id,
  invoiceNumber: r.invoice_number,
  invoiceDate: r.invoice_date,
  invoiceTotal: Number(r.invoice_total),
  clientId: r.client_id,
  clientName: r.client_name,
  clientGstin: r.client_gstin,
  amount: Number(r.amount_paise),
  paidOn: r.paid_on,
  mode: r.mode,
  reference: r.reference,
  note: r.note,
  createdAt: r.created_at,
  createdBy: r.created_by,
  receiptId: r.receipt_id,
  receiptNumber: r.receipt_number,
  receiptStatus: r.receipt_status,
  receiptRevision: r.receipt_revision ?? 1,
  receiptEmailedAt: r.receipt_emailed_at,
})

/** An invoice's payments, oldest first (the order receipts are numbered in). */
export async function listInvoicePayments(db: SupabaseClient, invoiceId: string): Promise<PaymentRow[]> {
  const { data, error } = await db.from("payment_rows").select(PAYMENT_COLUMNS).eq("invoice_id", invoiceId).is("deleted_at", null).order("paid_on").order("created_at").order("id")
  if (error) throw new DbError(error)
  return (data as PaymentDbRow[]).map(toPayment)
}

export async function getPayment(db: SupabaseClient, id: string): Promise<PaymentRow | null> {
  const { data, error } = await db.from("payment_rows").select(PAYMENT_COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle()
  if (error) throw new DbError(error)
  return data ? toPayment(data as PaymentDbRow) : null
}

export type PaymentFilters = { from?: string | null; to?: string | null; clients?: string[]; modes?: PaymentMode[]; q?: string }

/** PostgREST filter text: escape what it treats specially. */
const term = (q: string) => q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()"]/g, " ").trim()

/** Keyset cursor over (paid_on desc, created_at desc, id desc). */
export function encodeCursor(row: { paidOn: string; createdAt: string; id: string }) {
  return Buffer.from(`${row.paidOn}|${row.createdAt}|${row.id}`).toString("base64url")
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null
  const [paidOn, createdAt, id] = Buffer.from(cursor, "base64url").toString().split("|")
  return /^\d{4}-\d{2}-\d{2}$/.test(paidOn ?? "") && createdAt && /^[0-9a-f-]{36}$/.test(id ?? "") ? { paidOn, createdAt, id } : null
}

/** One page of payments, newest first, plus the cursor for the next page. */
export async function listPayments(db: SupabaseClient, f: PaymentFilters, opts: { cursor?: string; limit?: number } = {}) {
  const limit = opts.limit ?? 50
  let query = db.from("payment_rows").select(PAYMENT_COLUMNS).is("deleted_at", null)
  if (f.from) query = query.gte("paid_on", f.from)
  if (f.to) query = query.lte("paid_on", f.to)
  if (f.clients?.length) query = query.in("client_id", f.clients)
  if (f.modes?.length) query = query.in("mode", f.modes)
  const q = f.q ? term(f.q) : ""
  if (q) query = query.or(`reference.ilike.%${q}%,invoice_number.ilike.%${q}%,client_name.ilike.%${q}%,receipt_number.ilike.%${q}%`)
  const c = decodeCursor(opts.cursor)
  if (c) query = query.or(`paid_on.lt.${c.paidOn},and(paid_on.eq.${c.paidOn},created_at.lt.${c.createdAt}),and(paid_on.eq.${c.paidOn},created_at.eq.${c.createdAt},id.lt.${c.id})`)
  const { data, error } = await query.order("paid_on", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1)
  if (error) throw new DbError(error)
  const rows = (data as PaymentDbRow[]).map(toPayment)
  const page = rows.slice(0, limit)
  return { payments: page, next: rows.length > limit ? encodeCursor(page[page.length - 1]) : null }
}

export type PaymentSummary = { total: number; count: number; byMode: Partial<Record<PaymentMode, number>> }

export async function paymentSummary(db: SupabaseClient, f: PaymentFilters): Promise<PaymentSummary> {
  const { data, error } = await db.rpc("payment_summary", { p_from: f.from ?? null, p_to: f.to ?? null, p_clients: f.clients?.length ? f.clients : null, p_modes: f.modes?.length ? f.modes : null, p_q: f.q?.trim() || null })
  if (error) throw new DbError(error)
  const s = (data ?? {}) as { total?: number; count?: number; by_mode?: Record<string, number> }
  return { total: Number(s.total ?? 0), count: Number(s.count ?? 0), byMode: Object.fromEntries(Object.entries(s.by_mode ?? {}).map(([k, v]) => [k, Number(v)])) }
}

/** The mode the user picked last, so the dialog starts there. */
export async function lastPaymentMode(db: SupabaseClient): Promise<PaymentMode | null> {
  const { data, error } = await db.from("payments").select("mode").order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (error) return null
  return (data?.mode as PaymentMode | undefined) ?? null
}

/* ------------------------------- receipts ------------------------------ */

const RECEIPT_COLUMNS = "id, number, receipt_date, revision, status, public_token, link_active, emailed_at, email_count, void_reason, invoice_id, invoice_number, client_id, client_name, payment_id, amount_paise, mode, reference"

type ReceiptDbRow = {
  id: string
  number: string
  receipt_date: string
  revision: number
  status: "active" | "void"
  public_token: string
  link_active: boolean
  emailed_at: string | null
  email_count: number
  void_reason: string | null
  invoice_id: string
  invoice_number: string
  client_id: string | null
  client_name: string
  payment_id: string
  amount_paise: number
  mode: PaymentMode
  reference: string | null
}

const toReceipt = (r: ReceiptDbRow): ReceiptRow => ({
  id: r.id,
  number: r.number,
  date: r.receipt_date,
  revision: r.revision,
  status: r.status,
  publicToken: r.public_token,
  linkActive: r.link_active,
  emailedAt: r.emailed_at,
  emailCount: r.email_count,
  voidReason: r.void_reason,
  invoiceId: r.invoice_id,
  invoiceNumber: r.invoice_number,
  clientId: r.client_id,
  clientName: r.client_name,
  paymentId: r.payment_id,
  amount: Number(r.amount_paise),
  mode: r.mode,
  reference: r.reference,
})

export type ReceiptFilters = PaymentFilters & { status?: "active" | "void" | "all" }
export type ReceiptSort = "date" | "amount"

/** One page of receipts. Sorted by date (keyset) or by amount (offset). */
export async function listReceipts(db: SupabaseClient, f: ReceiptFilters, opts: { sort?: ReceiptSort; page?: number; limit?: number } = {}) {
  const limit = opts.limit ?? 50
  const page = Math.max(1, opts.page ?? 1)
  let query = db.from("receipt_rows").select(RECEIPT_COLUMNS)
  if (f.status && f.status !== "all") query = query.eq("status", f.status)
  if (f.from) query = query.gte("receipt_date", f.from)
  if (f.to) query = query.lte("receipt_date", f.to)
  if (f.clients?.length) query = query.in("client_id", f.clients)
  if (f.modes?.length) query = query.in("mode", f.modes)
  const q = f.q ? term(f.q) : ""
  if (q) query = query.or(`number.ilike.%${q}%,invoice_number.ilike.%${q}%,client_name.ilike.%${q}%,reference.ilike.%${q}%`)
  query = opts.sort === "amount" ? query.order("amount_paise", { ascending: false }).order("id") : query.order("receipt_date", { ascending: false }).order("created_at", { ascending: false }).order("id")
  const { data, error } = await query.range((page - 1) * limit, page * limit) // one extra row: is there more?
  if (error) throw new DbError(error)
  const rows = (data as ReceiptDbRow[]).map(toReceipt)
  return { receipts: rows.slice(0, limit), hasMore: rows.length > limit }
}

export async function hasAnyReceipt(db: SupabaseClient) {
  const { count, error } = await db.from("receipts").select("id", { count: "exact", head: true })
  if (error) throw new DbError(error)
  return (count ?? 0) > 0
}

/** The receipt for the owner: document data and the balance as of this payment. */
export async function getReceiptView(db: SupabaseClient, receiptId: string): Promise<ReceiptView | null> {
  if (!/^[0-9a-f-]{36}$/.test(receiptId)) return null
  const { data: r, error } = await db
    .from("receipts")
    .select("id, number, receipt_date, revision, status, void_reason, public_token, link_active, emailed_at, template_id, page_color, invoice_id, payment_id, payments(id, amount_paise, paid_on, mode, reference, note, created_at)")
    .eq("id", receiptId)
    .maybeSingle()
  if (error) throw new DbError(error)
  if (!r) return null
  const pay = (Array.isArray(r.payments) ? r.payments[0] : r.payments) as { id: string; amount_paise: number; paid_on: string; mode: PaymentMode; reference: string | null; note: string | null; created_at: string }
  const [{ data: inv, error: invError }, { data: siblings, error: sibError }] = await Promise.all([
    db.from("invoices").select("data, status, total").eq("id", r.invoice_id).single(),
    db.from("payments").select("id, amount_paise, paid_on, created_at").eq("invoice_id", r.invoice_id).is("deleted_at", null),
  ])
  if (invError) throw new DbError(invError)
  if (sibError) throw new DbError(sibError)
  const invoice = { ...(inv.data as Invoice), status: inv.status } as Invoice
  const total = Number(inv.total)
  const active = (siblings as { id: string; amount_paise: number; paid_on: string; created_at: string }[]).map((p) => ({ id: p.id, amount: Number(p.amount_paise), paidOn: p.paid_on, createdAt: p.created_at }))
  // a voided receipt still shows what it said: count its payment in its own place
  const withThis = active.some((p) => p.id === pay.id) ? active : [...active, { id: pay.id, amount: Number(pay.amount_paise), paidOn: pay.paid_on, createdAt: pay.created_at }]
  return {
    receipt: { id: r.id, number: r.number, date: r.receipt_date, revision: r.revision, status: r.status, voidReason: r.void_reason, publicToken: r.public_token, linkActive: r.link_active, emailedAt: r.emailed_at, templateId: r.template_id, pageColor: r.page_color },
    payment: { id: pay.id, amount: Number(pay.amount_paise), paidOn: pay.paid_on, mode: pay.mode, reference: pay.reference, note: pay.note },
    invoice,
    balance: receiptBalance(withThis, pay.id, total),
  }
}

/** For /r/<token>: works signed out, and only while the receipt and its link are active. */
export async function sharedReceipt(db: SupabaseClient, token: string): Promise<ReceiptView | null> {
  if (!/^[A-Za-z0-9_-]{32,96}$/.test(token)) return null
  const { data, error } = await db.rpc("shared_receipt", { p_token: token })
  if (error) {
    console.warn("[payments] shared_receipt failed:", error.message)
    return null
  }
  if (!data) return null
  const d = data as {
    receipt: { id: string; number: string; receipt_date: string; revision: number; status: "active" | "void"; template_id: string; page_color: "white" | "black" }
    payment: { id: string; amount_paise: number; paid_on: string; mode: PaymentMode; reference: string | null }
    invoice: Invoice & { total: number }
    invoice_link: string | null
    paid_before: number
  }
  const total = Number(d.invoice.total)
  const amount = Number(d.payment.amount_paise)
  const paidBefore = Number(d.paid_before)
  const remaining = Math.max(0, total - paidBefore - amount)
  return {
    receipt: { id: d.receipt.id, number: d.receipt.number, date: d.receipt.receipt_date, revision: d.receipt.revision, status: d.receipt.status, voidReason: null, templateId: d.receipt.template_id, pageColor: d.receipt.page_color },
    payment: { id: d.payment.id, amount, paidOn: d.payment.paid_on, mode: d.payment.mode, reference: d.payment.reference },
    invoice: d.invoice,
    invoiceLink: d.invoice_link,
    balance: { total, paidBefore, thisPayment: amount, remaining, paidInFull: remaining === 0 },
  }
}

/* ------------------------------- activity ------------------------------ */

type ActivityDbRow = { id: string; action: string; invoice_id: string | null; client_id: string | null; actor_id: string | null; data: Record<string, unknown>; created_at: string }
type EventDbRow = { id: number; type: string; at: string; invoice_id: string; meta: Record<string, unknown> | null; invoices?: { number: string; client_name: string | null } | { number: string; client_name: string | null }[] | null }

/**
 * A timeline for one invoice, one client or one receipt: payment activity
 * plus the invoice's own events (sent, viewed, downloaded, reminded…).
 */
export async function listActivity(db: SupabaseClient, scope: { invoiceId?: string; clientId?: string; receiptId?: string }, userId: string, limit = 60): Promise<ActivityItem[]> {
  let acts = db.from("activities").select("id, action, invoice_id, client_id, actor_id, data, created_at").order("created_at", { ascending: false }).limit(limit)
  if (scope.invoiceId) acts = acts.eq("invoice_id", scope.invoiceId)
  if (scope.clientId) acts = acts.eq("client_id", scope.clientId)
  if (scope.receiptId) acts = acts.eq("entity_type", "receipt").eq("entity_id", scope.receiptId)

  const [a, invoiceIds] = await Promise.all([
    acts,
    scope.clientId ? db.from("invoices").select("id").eq("client_id", scope.clientId).neq("status", "draft") : Promise.resolve({ data: scope.invoiceId ? [{ id: scope.invoiceId }] : [], error: null }),
  ])
  if (a.error) throw new DbError(a.error)
  if (invoiceIds.error) throw new DbError(invoiceIds.error)

  const ids = (invoiceIds.data as { id: string }[]).map((r) => r.id)
  let events: EventDbRow[] = []
  if (!scope.receiptId && ids.length) {
    const { data, error } = await db.from("invoice_events").select("id, type, at, invoice_id, meta, invoices(number, client_name)").in("invoice_id", ids.slice(0, 200)).neq("type", "paid").order("at", { ascending: false }).limit(limit)
    if (error) throw new DbError(error)
    events = data as EventDbRow[]
  }

  const items: ActivityItem[] = [
    ...(a.data as ActivityDbRow[]).map((r) => ({ id: r.id, at: r.created_at, action: r.action, invoiceId: r.invoice_id, invoiceNumber: (r.data.invoice_number as string | undefined) ?? undefined, data: r.data, actor: r.actor_id === userId ? ("you" as const) : null })),
    ...events.map((e) => {
      const inv = Array.isArray(e.invoices) ? e.invoices[0] : e.invoices
      return { id: `e${e.id}`, at: e.at, action: `invoice.${e.type}`, invoiceId: e.invoice_id, invoiceNumber: inv?.number, clientName: inv?.client_name ?? undefined, data: e.meta ?? {}, actor: e.type === "viewed" || e.type === "downloaded" ? null : ("you" as const) }
    }),
  ]
  return items.sort((x, y) => y.at.localeCompare(x.at)).slice(0, limit)
}

/** Latest payment activity across the account, for the dashboard. */
export async function listRecentPaymentActivity(db: SupabaseClient, limit = 8) {
  const { data, error } = await db.from("activities").select("id, action, invoice_id, data, created_at").in("action", ["payment.recorded", "payment.deleted"]).order("created_at", { ascending: false }).limit(limit)
  if (error) throw new DbError(error)
  return data as { id: string; action: string; invoice_id: string | null; data: Record<string, unknown>; created_at: string }[]
}
