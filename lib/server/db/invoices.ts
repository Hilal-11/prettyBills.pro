import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

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
  "id, number, status, client_id, client_name, issue_date, due_date, currency, total, amount_paid, balance_due, missing_fields, template_id, public_token, link_active, sent_at, viewed_at, paid_at, created_at, updated_at"

type SummaryRow = {
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
}

const OPEN = ["sent", "viewed", "partially_paid"] as const

export function bucketOf(status: string, dueDate: string | null, balanceDue: number, on = today()): InvoiceBucket {
  return bucket(status, dueDate, balanceDue, on)
}

function toSummary(r: SummaryRow, on: string): InvoiceSummary {
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
 * from the client. Returns the stored status so the editor can reflect it.
 */
export async function saveInvoice(db: SupabaseClient, userId: string, invoice: Invoice) {
  const { data: existing, error: readError } = await db.from("invoices").select("status, paid_at, public_token, sent_at").eq("id", invoice.id).maybeSingle<NonNullable<Existing>>()
  if (readError) throw new DbError(readError)

  const totals = computeInvoiceTotals(invoice)
  const amountPaid = Math.max(0, Math.round(invoice.payment?.amountPaid ?? 0))
  let status: SummaryRow["status"] = settleStatus(invoice.status, totals.total, amountPaid)
  // a stale editor mustn't undo a view the server recorded
  if (status === "sent" && existing?.status === "viewed") status = "viewed"
  const becamePaid = status === "paid" && existing?.status !== "paid"
  const paidAt = status === "paid" ? (existing?.paid_at ?? new Date().toISOString()) : null

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
    amount_paid: amountPaid,
    missing_fields: validateInvoice(invoice).requiredMissing,
    template_id: invoice.templateId,
    link_active: invoice.linkActive,
    paid_at: paidAt,
    data: doc,
  }

  const { data, error } = await db.from("invoices").upsert(row, { onConflict: "id" }).select("updated_at").single()
  if (error) throw new DbError(error)
  if (!existing) await addEvent(db, userId, invoice.id, "created")
  if (becamePaid) await addEvent(db, userId, invoice.id, "paid")
  return { savedAt: data.updated_at as string, status }
}

export async function addEvent(db: SupabaseClient, userId: string, invoiceId: string, type: InvoiceEvent["type"]) {
  const { error } = await db.from("invoice_events").insert({ invoice_id: invoiceId, user_id: userId, type })
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
export async function markSent(db: SupabaseClient, userId: string, invoice: Invoice) {
  const sentAt = new Date().toISOString()
  const status = invoice.status === "draft" ? "sent" : invoice.status
  const saved = await saveInvoice(db, userId, { ...invoice, status })
  const { error } = await db.from("invoices").update({ sent_at: sentAt, data: { ...invoice, status: saved.status, sentAt } }).eq("id", invoice.id)
  if (error) throw new DbError(error)
  await addEvent(db, userId, invoice.id, "sent")
  return { sentAt, status: saved.status }
}

/** Records a payment in full (or clears it), keeping the document in step. */
export async function setPaid(db: SupabaseClient, userId: string, id: string, paid: boolean) {
  const invoice = await getInvoice(db, id)
  if (!invoice) return null
  if (invoice.status === "draft" || invoice.status === "void") throw new Error("Only sent invoices can be marked paid.")
  const total = computeInvoiceTotals(invoice).total
  const next: Invoice = { ...invoice, status: paid ? "paid" : "sent", payment: { ...invoice.payment, amountPaid: paid ? total : 0 } }
  return saveInvoice(db, userId, next)
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

export type Activity = { type: InvoiceEvent["type"]; at: string; invoiceId: string; number: string; clientName: string }

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
