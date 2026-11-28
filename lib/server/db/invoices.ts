import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { addDays } from "@/lib/billing/dates"
import { issueRange, UPCOMING_DAYS, weeklySeries, type InvoiceQuery, type InvoiceSort } from "@/lib/billing/invoice-query"
import type { PaymentMode } from "@/lib/billing/modes"
import { bucketOf as bucket, settleStatus } from "@/lib/data/status"
import { EMPTY_OVERVIEW, type InvoiceBucket, type InvoiceEvent, type InvoiceSummary, type Overview } from "@/lib/data/types"
import { randomToken } from "@/lib/invoice/format"
import { computeInvoiceTotals } from "@/lib/invoice/totals"
import type { Invoice } from "@/lib/invoice/types"
import { validateInvoice } from "@/lib/invoice/validate"

import { DbError, daysBetween, today } from "./util"

/**
 * Invoices in Postgres. Every function takes the request's Supabase client, so
 * row level security decides what the caller can see: a row that isn't yours
 * simply doesn't exist here.
 */

const SUMMARY_COLUMNS =
  "id, number, status, client_id, client_name, issue_date, due_date, currency, total, amount_paid, balance_due, missing_fields, template_id, public_token, link_active, sent_at, viewed_at, paid_at, created_at, updated_at, credited_paise, cancelled"

export type SummaryRow = {
  id: string
  number: string
  status: InvoiceSummary["status"]
  client_id: string | null
  client_name: string | null
  issue_date: string
  due_date: string | null
  currency: string
  total: number
  amount_paid: number
  balance_due: number
  missing_fields: number
  template_id: string | null
  public_token: string | null
  link_active: boolean
  sent_at: string | null
  viewed_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
  credited_paise?: number
  cancelled?: boolean
}

const OPEN = ["sent", "viewed", "partially_paid"] as const

export function bucketOf(status: string, dueDate: string | null, balanceDue: number, on = today()): InvoiceBucket {
  return bucket(status, dueDate, balanceDue, on)
}

export function toSummary(r: SummaryRow, on: string): InvoiceSummary {
  const balanceDue = Number(r.balance_due)
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    bucket: bucketOf(r.status, r.due_date, balanceDue, on),
    clientId: r.client_id,
    clientName: r.client_name ?? "",
    issueDate: r.issue_date,
    dueDate: r.due_date,
    currency: r.currency,
    total: Number(r.total),
    amountPaid: Number(r.amount_paid),
    balanceDue,
    missingFields: r.missing_fields,
    templateId: r.template_id,
    publicToken: r.public_token,
    linkActive: r.link_active,
    sentAt: r.sent_at,
    viewedAt: r.viewed_at,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    daysPastDue: r.due_date ? daysBetween(r.due_date, on) : null,
    creditedPaise: Number(r.credited_paise ?? 0),
    cancelled: !!r.cancelled,
  }
}

/* -------------------------------- reads -------------------------------- */

export type ListOptions = { bucket?: InvoiceBucket | "all"; q?: string; clientId?: string; limit?: number; offset?: number }

/** One page of invoices for a list view, plus whether there are more. */
export async function listInvoices(db: SupabaseClient, opts: ListOptions = {}) {
  const on = today()
  const limit = opts.limit ?? 50
  let query = db.from("invoices").select(SUMMARY_COLUMNS)

  switch (opts.bucket) {
    case "draft":
      query = query.eq("status", "draft").order("updated_at", { ascending: false })
      break
    case "sent":
      // awaiting payment and not yet late: soonest due first
      query = query.in("status", OPEN).or(`due_date.is.null,due_date.gte.${on},balance_due.eq.0`).order("due_date", { ascending: true, nullsFirst: false })
      break
    case "overdue":
      query = query.in("status", OPEN).lt("due_date", on).gt("balance_due", 0).order("due_date", { ascending: true })
      break
    case "paid":
      query = query.eq("status", "paid").order("paid_at", { ascending: false, nullsFirst: false })
      break
    case "void":
      query = query.eq("status", "void").order("updated_at", { ascending: false })
      break
    default:
      query = query.order("issue_date", { ascending: false }).order("created_at", { ascending: false })
  }

  if (opts.clientId) query = query.eq("client_id", opts.clientId)
  const q = opts.q?.trim()
  if (q) {
    // PostgREST filter syntax: escape the characters it treats specially
    const term = q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ")
    query = query.or(`number.ilike.%${term}%,client_name.ilike.%${term}%`)
  }

  const from = opts.offset ?? 0
  const { data, error } = await query.range(from, from + limit) // one extra row tells us there's more
  if (error) throw new DbError(error)
  const rows = (data as SummaryRow[]).map((r) => toSummary(r, on))
  return { invoices: rows.slice(0, limit), hasMore: rows.length > limit }
}

/** Everything about the user's invoices the dashboard needs, aggregated in Postgres. */
export async function getOverview(db: SupabaseClient): Promise<Overview> {
  const { data, error } = await db.rpc("invoice_overview", { p_today: today() })
  if (error) throw new DbError(error)
  return overviewOf(data)
}

/** The overview numbers from the database's JSON (invoice_overview, dashboard_data). */
export function overviewOf(data: unknown): Overview {
  const o = (data ?? {}) as Record<string, number>
  return {
    all: o.all ?? 0,
    drafts: o.drafts ?? 0,
    draftsReady: o.drafts_ready ?? 0,
    sent: o.sent ?? 0,
    overdue: o.overdue ?? 0,
    paid: o.paid ?? 0,
    outstanding: Number(o.outstanding ?? 0),
    overdueAmount: Number(o.overdue_amount ?? 0),
    collectedMonth: Number(o.collected_month ?? 0),
    invoicedMonth: Number(o.invoiced_month ?? 0),
    invoicedMonthCount: o.invoiced_month_count ?? 0,
    outstandingCount: o.outstanding_count ?? (o.sent ?? 0) + (o.overdue ?? 0),
    oldestOverdueDays: o.oldest_overdue_days ?? 0,
    collectedLastMonth: Number(o.collected_last_month ?? 0),
    avgDaysToPay: o.avg_days_to_pay == null ? null : Number(o.avg_days_to_pay),
    avgDaysSample: o.avg_days_sample ?? 0,
  }
}

export { EMPTY_OVERVIEW }

/** The full invoice, with server-owned fields taken from their columns. */
export async function getInvoice(db: SupabaseClient, id: string): Promise<Invoice | null> {
  const { data, error } = await db.from("invoices").select("data, status, public_token, link_active, sent_at").eq("id", id).maybeSingle()
  if (error) throw new DbError(error)
  if (!data) return null
  return {
    ...(data.data as Invoice),
    status: data.status,
    publicToken: data.public_token ?? undefined,
    linkActive: data.link_active,
    sentAt: data.sent_at ?? undefined,
  }
}

/** Every number this user has used, for numbering and the duplicate check. */
export async function listNumbers(db: SupabaseClient) {
  const { data, error } = await db.from("invoices").select("id, number").neq("number", "")
  if (error) throw new DbError(error)
  return data as { id: string; number: string }[]
}

export async function listEvents(db: SupabaseClient, invoiceId: string): Promise<InvoiceEvent[]> {
  const { data, error } = await db.from("invoice_events").select("type, at").eq("invoice_id", invoiceId).order("at", { ascending: true }).limit(100)
  if (error) throw new DbError(error)
  return data as InvoiceEvent[]
}

/* -------------------------------- writes ------------------------------- */

type Existing = { status: SummaryRow["status"]; paid_at: string | null; public_token: string | null; sent_at: string | null } | null

/**
 * Creates or replaces an invoice from the editor. The document is stored whole;
 * list columns are derived from it here, so they can never disagree.
 * Columns the server owns (link token, sent/viewed/paid times) aren't taken
 * from the client, and what's been received comes only from recorded
 * payments: the database recomputes amount paid, paid/part-paid status and
 * the paid date on every write (and refuses a total below what's been paid).
 * Returns the stored status and amount paid so the editor can reflect them.
 */
export async function saveInvoice(db: SupabaseClient, userId: string, invoice: Invoice) {
  const { data: existing, error: readError } = await db.from("invoices").select("status, paid_at, public_token, sent_at").eq("id", invoice.id).maybeSingle<NonNullable<Existing>>()
  if (readError) throw new DbError(readError)

  const totals = computeInvoiceTotals(invoice)
  // lifecycle only (draft / sent / void); the trigger works out the money part
  const status: SummaryRow["status"] = settleStatus(invoice.status, totals.total, 0)

  const doc: Invoice = { ...invoice, status, publicToken: existing?.public_token ?? undefined, sentAt: existing?.sent_at ?? undefined }
  const row = {
    id: invoice.id,
    user_id: userId,
    number: invoice.number.trim(),
    status,
    client_id: invoice.clientId || null,
    client_name: invoice.billTo?.name?.slice(0, 200) || null,
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate || null,
    currency: invoice.currency || "INR",
    total: totals.total,
    missing_fields: validateInvoice(invoice).requiredMissing,
    template_id: invoice.templateId,
    link_active: invoice.linkActive,
    data: doc,
  }

  const { data, error } = await db.from("invoices").upsert(row, { onConflict: "id" }).select("updated_at, status, amount_paid").single()
  if (error) throw new DbError(error)
  if (!existing) await addEvent(db, userId, invoice.id, "created")
  return { savedAt: data.updated_at as string, status: data.status as SummaryRow["status"], amountPaid: Number(data.amount_paid) }
}

export async function addEvent(db: SupabaseClient, userId: string, invoiceId: string, type: InvoiceEvent["type"], meta?: Record<string, unknown>) {
  const { error } = await db.from("invoice_events").insert({ invoice_id: invoiceId, user_id: userId, type, meta: meta ?? null })
  if (error) console.warn(`[invoices] couldn't record ${type} for ${invoiceId}: ${error.message}`)
}

/** Creates the share token on first use. Returns the token and whether the link is on. */
export async function ensureShareLink(db: SupabaseClient, id: string, active?: boolean) {
  const { data: row, error } = await db.from("invoices").select("public_token, link_active").eq("id", id).maybeSingle()
  if (error) throw new DbError(error)
  if (!row) return null
  const patch: Record<string, unknown> = {}
  const token = (row.public_token as string | null) ?? randomToken(18)
  if (!row.public_token) patch.public_token = token
  if (typeof active === "boolean" && active !== row.link_active) patch.link_active = active
  if (Object.keys(patch).length) {
    // keep the document in step with the columns
    const { data: doc } = await db.from("invoices").select("data").eq("id", id).single()
    const data = { ...(doc?.data as Invoice), publicToken: token, linkActive: patch.link_active ?? row.link_active }
    const { error: updateError } = await db
      .from("invoices")
      .update({ ...patch, data })
      .eq("id", id)
    if (updateError) throw new DbError(updateError)
  }
  return { token, active: (patch.link_active as boolean | undefined) ?? (row.link_active as boolean) }
}

/** After an email goes out: status, sent time and the event. */
export async function markSent(db: SupabaseClient, userId: string, invoice: Invoice, meta?: Record<string, unknown>) {
  const sentAt = new Date().toISOString()
  const status = invoice.status === "draft" ? "sent" : invoice.status
  const saved = await saveInvoice(db, userId, { ...invoice, status })
  const { error } = await db.from("invoices").update({ sent_at: sentAt, data: { ...invoice, status: saved.status, sentAt } }).eq("id", invoice.id)
  if (error) throw new DbError(error)
  await addEvent(db, userId, invoice.id, "sent", meta)
  return { sentAt, status: saved.status }
}

/**
 * Marks a finished draft as sent without emailing it (it went out as a PDF,
 * a link or on WhatsApp). Needed before payments can be recorded.
 */
export async function markSentManually(db: SupabaseClient, userId: string, id: string) {
  const invoice = await getInvoice(db, id)
  if (!invoice) return null
  if (invoice.status !== "draft") return { status: invoice.status }
  const missing = validateInvoice(invoice).requiredMissing
  if (missing > 0) throw new Error(`Fill in ${missing} required field${missing === 1 ? "" : "s"} before marking it sent.`)
  const sent = await markSent(db, userId, { ...invoice, status: "sent" }, { manual: true })
  return { status: sent.status }
}

/** Cancels a sent invoice but keeps it (and its number) on record, as GST rules expect. */
export async function voidInvoice(db: SupabaseClient, userId: string, id: string) {
  const invoice = await getInvoice(db, id)
  if (!invoice) return null
  await saveInvoice(db, userId, { ...invoice, status: "void", linkActive: false })
  await addEvent(db, userId, id, "voided")
  return true
}

/** Drafts only: anything that was sent is voided instead. */
export async function deleteDraft(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("invoices").delete().eq("id", id).eq("status", "draft").select("id")
  if (error) throw new DbError(error)
  return data.length > 0
}

/** A fresh draft from an existing invoice, dated today with the next number. */
export async function duplicateInvoice(db: SupabaseClient, userId: string, id: string, newId: string, number: string) {
  const invoice = await getInvoice(db, id)
  if (!invoice) return null
  const on = today()
  const gap = invoice.dueDate && invoice.issueDate ? Math.max(0, daysBetween(invoice.issueDate, invoice.dueDate)) : 15
  const due = new Date(`${on}T00:00:00Z`)
  due.setUTCDate(due.getUTCDate() + gap)
  const copy: Invoice = {
    ...invoice,
    id: newId,
    number,
    status: "draft",
    issueDate: on,
    dueDate: due.toISOString().slice(0, 10),
    payment: { ...invoice.payment, amountPaid: 0 },
    publicToken: undefined,
    sentAt: undefined,
    linkActive: true,
    revision: 1,
    createdAt: on,
    updatedAt: on,
  }
  await saveInvoice(db, userId, copy)
  return copy
}

/* ------------------------------ shared links --------------------------- */

/** For the public page: the invoice behind a token, or null. Works signed out. */
export async function sharedInvoice(db: SupabaseClient, token: string): Promise<Invoice | null> {
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(token)) return null
  const { data, error } = await db.rpc("shared_invoice", { p_token: token })
  if (error) {
    console.warn("[invoices] shared_invoice failed:", error.message)
    return null
  }
  return (data as Invoice | null) ?? null
}

/** Records a view or download of a shared link. Returns true the first time. */
export async function trackShared(db: SupabaseClient, token: string, type: "viewed" | "downloaded") {
  const { data, error } = await db.rpc("track_shared_invoice", { p_token: token, p_type: type })
  if (error) {
    console.warn("[invoices] track_shared_invoice failed:", error.message)
    return null
  }
  return data as boolean | null
}

/* -------------------------------- activity ----------------------------- */

export type Activity = { type: InvoiceEvent["type"] | "payment" | "payment_deleted"; at: string; invoiceId: string; number: string; clientName: string; detail?: string }

/** The latest things that happened across the user's invoices (not counting drafts being created). */
export async function listRecentActivity(db: SupabaseClient, limit = 8): Promise<Activity[]> {
  const { data, error } = await db
    .from("invoice_events")
    .select("type, at, invoice_id, invoices(number, client_name)")
    .neq("type", "created")
    .order("at", { ascending: false })
    .limit(limit)
  if (error) throw new DbError(error)
  type Row = { type: InvoiceEvent["type"]; at: string; invoice_id: string; invoices: { number: string; client_name: string | null } | { number: string; client_name: string | null }[] | null }
  return (data as Row[]).map((r) => {
    const inv = Array.isArray(r.invoices) ? r.invoices[0] : r.invoices
    return { type: r.type, at: r.at, invoiceId: r.invoice_id, number: inv?.number ?? "", clientName: inv?.client_name ?? "" }
  })
}

/* ---------------------------- invoices table ---------------------------- */

const SORT_COLUMN: Record<InvoiceSort, string> = {
  number: "number",
  client: "client_name",
  amount: "total",
  balance: "balance_due",
  issued: "issue_date",
  due: "due_date",
  paid: "paid_at",
  updated: "updated_at",
}

/**
 * The invoices table: one tab, the filters from the URL, sorted, with the
 * exact number of matches. `limit` rows from `offset`.
 */
export async function queryInvoices(db: SupabaseClient, q: InvoiceQuery, opts: { limit: number; offset?: number; ids?: string[] }) {
  const on = today()
  let query = db.from("invoices").select(SUMMARY_COLUMNS, { count: "exact" })

  switch (q.view) {
    case "draft":
      query = query.eq("status", "draft")
      break
    case "sent":
      query = query.in("status", OPEN).or(`due_date.is.null,due_date.gte.${on},balance_due.eq.0`)
      break
    case "overdue":
      query = query.in("status", OPEN).lt("due_date", on).gt("balance_due", 0)
      break
    case "upcoming":
      query = query.in("status", OPEN).gt("balance_due", 0).gte("due_date", on).lte("due_date", addDays(on, UPCOMING_DAYS))
      break
    case "paid":
      query = query.eq("status", "paid")
      break
    case "void":
      query = query.eq("status", "void")
      break
  }

  if (opts.ids) query = query.in("id", opts.ids)
  if (q.clients.length) query = query.in("client_id", q.clients)
  const range = issueRange(q, on)
  if (range.from) query = query.gte("issue_date", range.from)
  if (range.to) query = query.lte("issue_date", range.to)
  if (q.min !== null) query = query.gte("total", q.min)
  if (q.max !== null) query = query.lte("total", q.max)
  const term = q.q.trim()
  if (term) {
    const safe = term.replace(/[%_\]/g, (c) => `\${c}`).replace(/[,()]/g, " ")
    query = query.or(`number.ilike.%${safe}%,client_name.ilike.%${safe}%`)
  }

  const asc = q.dir === "asc"
  // blanks (no due date, not paid yet) go last whichever way it's sorted
  query = query.order(SORT_COLUMN[q.sort], { ascending: asc, nullsFirst: false })
  if (q.sort !== "issued") query = query.order("issue_date", { ascending: false })
  query = query.order("created_at", { ascending: false }).order("id")

  const from = opts.offset ?? 0
  const { data, error, count } = await query.range(from, from + opts.limit - 1)
  if (error) throw new DbError(error)
  return { invoices: (data as SummaryRow[]).map((r) => toSummary(r, on)), total: count ?? 0 }
}

/** How each invoice was paid: the latest payment's mode, and how many different modes. */
export async function paymentMethods(db: SupabaseClient, ids: string[]) {
  const out: Record<string, { mode: PaymentMode; modes: number }> = {}
  if (!ids.length) return out
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150))
  const results = await Promise.all(
    chunks.map((chunk) => db.from("payments").select("invoice_id, mode, paid_on, created_at").in("invoice_id", chunk).is("deleted_at", null).order("paid_on").order("created_at"))
  )
  const seen: Record<string, Set<string>> = {}
  for (const { data, error } of results) {
    if (error) throw new DbError(error)
    for (const p of data as { invoice_id: string; mode: PaymentMode }[]) {
      ;(seen[p.invoice_id] ??= new Set()).add(p.mode)
      out[p.invoice_id] = { mode: p.mode, modes: seen[p.invoice_id].size }
    }
  }
  return out
}

export type InvoiceInsights = ReturnType<typeof weeklySeries> & { voided: number }

/**
 * Sparklines for the KPI strip and the Upcoming count. Reads only invoices
 * that were unpaid at some point in the last 12 weeks and the payments
 * since, then rebuilds each week's balances (lib/billing/invoice-query).
 */
export async function invoiceInsights(db: SupabaseClient): Promise<InvoiceInsights> {
  const on = today()
  const start = addDays(on, -7 * 12)
  const [inv, pay, voided] = await Promise.all([
    db
      .from("invoices")
      .select("id, total, amount_paid, balance_due, issue_date, due_date, status")
      .in("status", [...OPEN, "paid"])
      .or(`status.neq.paid,paid_at.gte.${start}`)
      .limit(5000),
    db.from("payments").select("invoice_id, amount_paise, paid_on").is("deleted_at", null).gte("paid_on", start).limit(10000),
    db.from("invoices").select("id", { count: "exact", head: true }).eq("status", "void"),
  ])
  if (inv.error) throw new DbError(inv.error)
  if (pay.error) throw new DbError(pay.error)
  const invoices = (inv.data as { id: string; total: number; amount_paid: number; balance_due: number; issue_date: string; due_date: string | null; status: string }[]).map((r) => ({
    id: r.id,
    total: Number(r.total),
    amountPaid: Number(r.amount_paid),
    balanceDue: Number(r.balance_due),
    issueDate: r.issue_date,
    dueDate: r.due_date,
    status: r.status,
  }))
  const payments = (pay.data as { invoice_id: string; amount_paise: number; paid_on: string }[]).map((p) => ({ invoiceId: p.invoice_id, amount: Number(p.amount_paise), paidOn: p.paid_on }))
  return { ...weeklySeries(invoices, payments, on), voided: voided.count ?? 0 }
}

/** Every invoice as a list row (newest first, capped), for dashboards that aggregate in code. */
export async function listSummaries(db: SupabaseClient, limit = 5000) {
  const on = today()
  const { data, error } = await db.from("invoices").select(SUMMARY_COLUMNS).order("issue_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit)
  if (error) throw new DbError(error)
  return (data as SummaryRow[]).map((r) => toSummary(r, on))
}
