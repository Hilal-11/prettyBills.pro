import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { addDays } from "@/lib/billing/dates"
import { daysLeft, displayStatus, isExpired, remainingLines, type ConversionLine, type QuoteDisplay, type QuoteStatus } from "@/lib/billing/quotes"
import { computeInvoiceTotals } from "@/lib/invoice/totals"
import type { Invoice, QuoteKind, QuoteTitle } from "@/lib/invoice/types"
import { validateInvoice } from "@/lib/invoice/validate"

import { DbError, today } from "./util"

/**
 * Quotes and proforma invoices. Reads go through row level security (a row
 * that isn't yours doesn't exist); every write is one database function
 * (supabase/migrations/…_quotes_proformas.sql) that checks and logs it.
 */

const COLUMNS =
  "id, kind, number, revision, status, client_id, client_name, issue_date, valid_until, currency, title, total_paise, converted_paise, converted_to_type, converted_to_id, source_quote_id, sent_at, viewed_at, responded_at, response_action, response_by, response_name, response_comment, response_revision, public_token, link_active, emailed_at, voided_at, void_reason, missing_fields, created_at, updated_at"

type Row = {
  id: string
  kind: QuoteKind
  number: string
  revision: number
  status: QuoteStatus
  client_id: string | null
  client_name: string | null
  issue_date: string
  valid_until: string | null
  currency: string
  title: string | null
  total_paise: number
  converted_paise: number
  converted_to_type: "invoice" | "proforma" | null
  converted_to_id: string | null
  source_quote_id: string | null
  sent_at: string | null
  viewed_at: string | null
  responded_at: string | null
  response_action: "accepted" | "declined" | null
  response_by: "client" | "owner" | null
  response_name: string | null
  response_comment: string | null
  response_revision: number | null
  public_token: string | null
  link_active: boolean
  emailed_at: string | null
  voided_at: string | null
  void_reason: string | null
  missing_fields: number
  created_at: string
  updated_at: string
}

export type QuoteSummary = {
  id: string
  kind: QuoteKind
  number: string
  revision: number
  status: QuoteStatus
  display: QuoteDisplay
  clientId: string | null
  clientName: string
  issueDate: string
  validUntil: string | null
  daysLeft: number | null
  currency: string
  total: number
  convertedPaise: number
  convertedToType: "invoice" | "proforma" | null
  convertedToId: string | null
  sourceQuoteId: string | null
  sentAt: string | null
  viewedAt: string | null
  respondedAt: string | null
  responseAction: "accepted" | "declined" | null
  responseBy: "client" | "owner" | null
  responseName: string | null
  responseComment: string | null
  responseRevision: number | null
  publicToken: string | null
  linkActive: boolean
  emailedAt: string | null
  voidedAt: string | null
  voidReason: string | null
  missingFields: number
  createdAt: string
  updatedAt: string
}

function toSummary(r: Row, on: string): QuoteSummary {
  return {
    id: r.id,
    kind: r.kind,
    number: r.number,
    revision: r.revision,
    status: r.status,
    display: displayStatus({ status: r.status, validUntil: r.valid_until, viewedAt: r.viewed_at }, on),
    clientId: r.client_id,
    clientName: r.client_name ?? "",
    issueDate: r.issue_date,
    validUntil: r.valid_until,
    daysLeft: daysLeft(r.valid_until, on),
    currency: r.currency,
    total: Number(r.total_paise),
    convertedPaise: Number(r.converted_paise),
    convertedToType: r.converted_to_type,
    convertedToId: r.converted_to_id,
    sourceQuoteId: r.source_quote_id,
    sentAt: r.sent_at,
    viewedAt: r.viewed_at,
    respondedAt: r.responded_at,
    responseAction: r.response_action,
    responseBy: r.response_by,
    responseName: r.response_name,
    responseComment: r.response_comment,
    responseRevision: r.response_revision,
    publicToken: r.public_token,
    linkActive: r.link_active,
    emailedAt: r.emailed_at,
    voidedAt: r.voided_at,
    voidReason: r.void_reason,
    missingFields: r.missing_fields,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/* ---------------------------------- lists --------------------------------- */

export const QUOTE_TABS = ["all", "draft", "open", "accepted", "declined", "converted", "expired", "void"] as const
export type QuoteTab = (typeof QUOTE_TABS)[number]

export type QuoteFilters = {
  kind: QuoteKind
  tab: QuoteTab
  q?: string
  clientId?: string
  from?: string | null
  to?: string | null
  /** Sent, still valid, and valid_until within the next 7 days. */
  expiringSoon?: boolean
}

export const EXPIRING_DAYS = 7

export async function listQuotes(db: SupabaseClient, f: QuoteFilters, opts: { limit?: number; offset?: number } = {}) {
  const on = today()
  const limit = opts.limit ?? 50
  let query = db.from("quotes").select(COLUMNS, { count: "exact" }).eq("kind", f.kind)
  switch (f.tab) {
    case "draft":
    case "accepted":
    case "declined":
    case "converted":
    case "void":
      query = query.eq("status", f.tab)
      break
    case "open":
      // waiting for an answer and still valid
      query = query.eq("status", "sent").or(`valid_until.is.null,valid_until.gte.${on}`)
      break
    case "expired":
      query = query.eq("status", "sent").lt("valid_until", on)
      break
  }
  if (f.expiringSoon) query = query.eq("status", "sent").gte("valid_until", on).lte("valid_until", addDays(on, EXPIRING_DAYS))
  if (f.clientId) query = query.eq("client_id", f.clientId)
  if (f.from) query = query.gte("issue_date", f.from)
  if (f.to) query = query.lte("issue_date", f.to)
  const term = f.q?.trim()
  if (term) {
    const safe = term.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ")
    query = query.or(`number.ilike.%${safe}%,client_name.ilike.%${safe}%,item_names.ilike.%${safe.toLowerCase()}%`)
  }
  query = f.expiringSoon || f.tab === "expired" ? query.order("valid_until", { ascending: true }) : query.order("issue_date", { ascending: false })
  query = query.order("created_at", { ascending: false }).order("id")
  const from = opts.offset ?? 0
  const { data, error, count } = await query.range(from, from + limit - 1)
  if (error) throw new DbError(error)
  return { quotes: (data as Row[]).map((r) => toSummary(r, on)), total: count ?? 0 }
}

export type QuoteStats = {
  counts: Record<QuoteTab, number>
  /** Sent and still waiting (including viewed), not expired. */
  openTotal: number
  openCount: number
  acceptedMonth: number
  acceptedMonthCount: number
  /** Accepted ÷ answered in the last 90 days, or null with no answers. */
  conversionRate: number | null
  expiringSoon: number
}

/** Tab counts and the summary strip, for one kind. Reads only the small columns. */
export async function quoteStats(db: SupabaseClient, kind: QuoteKind): Promise<QuoteStats> {
  const on = today()
  const { data, error } = await db.from("quotes").select("status, valid_until, total_paise, responded_at, response_action").eq("kind", kind).limit(10000)
  if (error) throw new DbError(error)
  const rows = data as { status: QuoteStatus; valid_until: string | null; total_paise: number; responded_at: string | null; response_action: string | null }[]
  const counts = Object.fromEntries(([...["all", "draft", "open", "accepted", "declined", "converted", "expired", "void"]] as QuoteTab[]).map((t) => [t, 0])) as Record<QuoteTab, number>
  const month = on.slice(0, 7)
  const since90 = addDays(on, -90)
  let openTotal = 0
  let openCount = 0
  let acceptedMonth = 0
  let acceptedMonthCount = 0
  let answered = 0
  let accepted = 0
  let expiringSoon = 0
  for (const r of rows) {
    counts.all++
    const expired = isExpired({ status: r.status, validUntil: r.valid_until }, on)
    if (r.status === "sent") counts[expired ? "expired" : "open"]++
    else counts[r.status]++
    if (r.status === "sent" && !expired) {
      openTotal += Number(r.total_paise)
      openCount++
      const d = daysLeft(r.valid_until, on)
      if (d !== null && d <= EXPIRING_DAYS) expiringSoon++
    }
    const respondedOn = r.responded_at ? todayOf(r.responded_at) : null
    if (r.response_action && respondedOn && respondedOn >= since90) {
      answered++
      if (r.response_action === "accepted") accepted++
    }
    if (r.response_action === "accepted" && respondedOn?.startsWith(month)) {
      acceptedMonth += Number(r.total_paise)
      acceptedMonthCount++
    }
  }
  return { counts, openTotal, openCount, acceptedMonth, acceptedMonthCount, conversionRate: answered ? accepted / answered : null, expiringSoon }
}

const todayOf = (ts: string) => today(new Date(ts))

/** "3 quotes awaiting response" on the dashboard: sent, still valid. */
export async function awaitingResponse(db: SupabaseClient) {
  const { count, error } = await db.from("quotes").select("id", { count: "exact", head: true }).eq("status", "sent").or(`valid_until.is.null,valid_until.gte.${today()}`)
  if (error) throw new DbError(error)
  return count ?? 0
}

export async function hasAnyQuote(db: SupabaseClient, kind: QuoteKind) {
  const { count, error } = await db.from("quotes").select("id", { count: "exact", head: true }).eq("kind", kind)
  if (error) throw new DbError(error)
  return (count ?? 0) > 0
}

/** A client's quotes and proformas, newest first. */
export async function clientQuotes(db: SupabaseClient, clientId: string, limit = 100) {
  const on = today()
  const { data, error } = await db.from("quotes").select(COLUMNS).eq("client_id", clientId).order("issue_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit)
  if (error) throw new DbError(error)
  return (data as Row[]).map((r) => toSummary(r, on))
}

export async function clientQuoteCount(db: SupabaseClient, clientId: string) {
  const { count, error } = await db.from("quotes").select("id", { count: "exact", head: true }).eq("client_id", clientId)
  if (error) throw new DbError(error)
  return count ?? 0
}

/* --------------------------------- one quote -------------------------------- */

export type QuoteRevision = { revision: number; status: QuoteStatus; total: number; createdAt: string }
export type QuoteConversion = { targetType: "invoice" | "proforma"; targetId: string; number: string | null; status: string | null; amount: number; lines: ConversionLine[]; createdAt: string }
export type QuoteActivity = { id: string; action: string; data: Record<string, unknown>; at: string; actor: boolean }

export type QuoteDetail = QuoteSummary & {
  document: Invoice
  revisions: QuoteRevision[]
  conversions: QuoteConversion[]
  activity: QuoteActivity[]
  /** The quote this proforma was made from. */
  source: { id: string; number: string; kind: QuoteKind } | null
}

/** The document with the server-owned fields taken from their columns. */
function documentOf(r: Row & { data: Invoice }): Invoice {
  return {
    ...r.data,
    id: r.id,
    number: r.number,
    revision: r.revision,
    status: "draft",
    publicToken: r.public_token ?? undefined,
    linkActive: r.link_active,
    sentAt: r.sent_at ?? undefined,
    quote: { ...(r.data.quote ?? { kind: r.kind, title: r.kind === "proforma" ? "Proforma Invoice" : "Quotation" }), kind: r.kind, validUntil: r.valid_until },
  }
}

export async function getQuoteDocument(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("quotes").select(`${COLUMNS}, data`).eq("id", id).maybeSingle()
  if (error) throw new DbError(error)
  if (!data) return null
  const row = data as Row & { data: Invoice }
  return { summary: toSummary(row, today()), document: documentOf(row) }
}

export async function getQuote(db: SupabaseClient, id: string): Promise<QuoteDetail | null> {
  const base = await getQuoteDocument(db, id)
  if (!base) return null
  const [revs, convs, acts, src] = await Promise.all([
    db.from("quote_revisions").select("revision, status, total_paise, created_at").eq("quote_id", id).order("revision", { ascending: false }),
    db.from("quote_conversions").select("target_type, target_id, amount_paise, lines, created_at").eq("quote_id", id).order("created_at", { ascending: true }),
    db.from("activities").select("id, action, data, actor_id, created_at").eq("entity_type", "quote").eq("entity_id", id).order("created_at", { ascending: false }).limit(60),
    base.summary.sourceQuoteId ? db.from("quotes").select("id, number, kind").eq("id", base.summary.sourceQuoteId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  for (const r of [revs, convs, acts]) if (r.error) throw new DbError(r.error)
  const conversions = (convs.data as { target_type: "invoice" | "proforma"; target_id: string; amount_paise: number; lines: ConversionLine[]; created_at: string }[]) ?? []
  // what each conversion became, and where it is now
  const invIds = conversions.filter((c) => c.target_type === "invoice").map((c) => c.target_id)
  const pfIds = conversions.filter((c) => c.target_type === "proforma").map((c) => c.target_id)
  const [inv, pf] = await Promise.all([
    invIds.length ? db.from("invoices").select("id, number, status").in("id", invIds) : Promise.resolve({ data: [], error: null }),
    pfIds.length ? db.from("quotes").select("id, number, status").in("id", pfIds) : Promise.resolve({ data: [], error: null }),
  ])
  const targets = new Map<string, { number: string; status: string }>([...((inv.data ?? []) as { id: string; number: string; status: string }[]), ...((pf.data ?? []) as { id: string; number: string; status: string }[])].map((t) => [t.id, t]))
  return {
    ...base.summary,
    document: base.document,
    revisions: ((revs.data ?? []) as { revision: number; status: QuoteStatus; total_paise: number; created_at: string }[]).map((r) => ({ revision: r.revision, status: r.status, total: Number(r.total_paise), createdAt: r.created_at })),
    conversions: conversions.map((c) => ({
      targetType: c.target_type,
      targetId: c.target_id,
      number: targets.get(c.target_id)?.number || null,
      status: targets.get(c.target_id)?.status ?? null,
      amount: Number(c.amount_paise),
      lines: c.lines,
      createdAt: c.created_at,
    })),
    activity: ((acts.data ?? []) as { id: string; action: string; data: Record<string, unknown>; actor_id: string | null; created_at: string }[]).map((a) => ({ id: a.id, action: a.action, data: a.data, at: a.created_at, actor: !!a.actor_id })),
    source: (src.data as { id: string; number: string; kind: QuoteKind } | null) ?? null,
  }
}

/** A revision the client saw before, read-only. */
export async function getRevision(db: SupabaseClient, id: string, revision: number): Promise<Invoice | null> {
  const { data, error } = await db.from("quote_revisions").select("snapshot").eq("quote_id", id).eq("revision", revision).maybeSingle()
  if (error) throw new DbError(error)
  return (data?.snapshot as Invoice | undefined) ?? null
}

/** What's left to convert, line by line. */
export async function conversionState(db: SupabaseClient, id: string) {
  const base = await getQuoteDocument(db, id)
  if (!base) return null
  const { data, error } = await db.from("quote_conversions").select("lines").eq("quote_id", id)
  if (error) throw new DbError(error)
  return { ...base, remaining: remainingLines(base.document.items, (data ?? []) as { lines: ConversionLine[] }[]) }
}

/** The quote or proforma an invoice was made from (for the "Created from" chip). */
export async function invoiceSource(db: SupabaseClient, invoiceId: string) {
  const { data, error } = await db.from("invoices").select("source_document_type, source_document_id").eq("id", invoiceId).maybeSingle()
  if (error) throw new DbError(error)
  if (!data?.source_document_id || data.source_document_type === "recurring") return null
  const { data: q } = await db.from("quotes").select("id, number, kind").eq("id", data.source_document_id).maybeSingle()
  return (q as { id: string; number: string; kind: QuoteKind } | null) ?? null
}

/* ---------------------------------- settings -------------------------------- */

export type QuoteSettings = { title: Exclude<QuoteTitle, "Proforma Invoice">; validityDays: number; allowMultiple: boolean; autoConvert: boolean; expiryReminders: boolean }
export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = { title: "Quotation", validityDays: 15, allowMultiple: false, autoConvert: false, expiryReminders: false }

export async function getQuoteSettings(db: SupabaseClient): Promise<QuoteSettings> {
  const { data, error } = await db.from("workspace_settings").select("quote_title, quote_validity_days, allow_multiple_conversions, auto_convert_accepted, quote_expiry_reminders").maybeSingle()
  if (error) {
    // before the quotes migration runs, everyone has the defaults
    if (error.code === "42703") return DEFAULT_QUOTE_SETTINGS
    throw new DbError(error)
  }
  if (!data) return DEFAULT_QUOTE_SETTINGS
  return {
    title: data.quote_title === "Estimate" ? "Estimate" : "Quotation",
    validityDays: Number(data.quote_validity_days) || 15,
    allowMultiple: !!data.allow_multiple_conversions,
    autoConvert: !!data.auto_convert_accepted,
    expiryReminders: !!data.quote_expiry_reminders,
  }
}

export async function saveQuoteSettings(db: SupabaseClient, userId: string, s: QuoteSettings) {
  const { error } = await db.from("workspace_settings").upsert(
    {
      user_id: userId,
      quote_title: s.title,
      quote_validity_days: s.validityDays,
      allow_multiple_conversions: s.allowMultiple,
      auto_convert_accepted: s.autoConvert,
      quote_expiry_reminders: s.expiryReminders,
    },
    { onConflict: "user_id" }
  )
  if (error) throw new DbError(error)
}

/* ---------------------------------- writes ---------------------------------- */

export type QuoteResult = {
  id: string
  kind: QuoteKind
  number: string
  revision: number
  status: QuoteStatus
  sentAt: string | null
  publicToken: string | null
  linkActive: boolean
  convertedToType: "invoice" | "proforma" | null
  convertedToId: string | null
  convertedPaise: number
  updatedAt: string
  created?: boolean
  replayed?: boolean
}

async function call<T = QuoteResult>(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw new DbError(error)
  return data as T
}

/** The editor's autosave. Totals come from the same invoice maths the preview uses. */
export function saveQuote(db: SupabaseClient, doc: Invoice, kind: QuoteKind, key: string) {
  const t = computeInvoiceTotals(doc)
  const totals = { taxable: t.taxableTotal + t.chargesTotal, tax: t.taxTotal, total: t.total, missing: validateInvoice(doc).requiredMissing }
  return call(db, "save_quote", { p_id: doc.id, p_kind: kind, p_doc: doc, p_totals: totals, p_idempotency_key: key })
}

export const sendQuote = (db: SupabaseClient, id: string, via: "email" | "link" | "whatsapp" | "manual") => call(db, "send_quote", { p_id: id, p_via: via })
export const quoteShareLink = (db: SupabaseClient, id: string, active?: boolean) => call(db, "quote_share_link", { p_id: id, p_active: typeof active === "boolean" ? active : null })
export const reviseQuote = (db: SupabaseClient, id: string, confirm: boolean) => call(db, "revise_quote", { p_id: id, p_confirm: confirm })
export const setQuoteStatus = (db: SupabaseClient, id: string, status: "accepted" | "declined", note?: string) => call(db, "set_quote_status", { p_id: id, p_status: status, p_note: note ?? null })
export const voidQuote = (db: SupabaseClient, id: string, reason: string) => call(db, "void_quote", { p_id: id, p_reason: reason })
export const duplicateQuote = (db: SupabaseClient, id: string, newId: string, key: string) => call(db, "duplicate_quote", { p_id: id, p_new_id: newId, p_idempotency_key: key })

export function convertQuote(db: SupabaseClient, args: { id: string; target: "invoice" | "proforma"; lines: ConversionLine[] | null; doc: Invoice; newId: string; key: string }) {
  const t = computeInvoiceTotals(args.doc)
  return call<{ targetType: "invoice" | "proforma"; targetId: string; replayed: boolean }>(db, "convert_quote", {
    p_id: args.id,
    p_target: args.target,
    p_lines: args.lines,
    p_doc: args.doc,
    p_total: t.total,
    p_missing: validateInvoice(args.doc).requiredMissing,
    p_new_id: args.newId,
    p_idempotency_key: args.key,
  })
}

/* --------------------------------- public page -------------------------------- */

export type SharedQuote = {
  document: Invoice
  kind: QuoteKind
  number: string
  revision: number
  status: QuoteStatus | "revising"
  validUntil: string | null
  expired: boolean
  response: { action: "accepted" | "declined"; name: string | null; comment: string | null; at: string; by: "client" | "owner" } | null
}

export async function sharedQuote(db: SupabaseClient, token: string): Promise<SharedQuote | null> {
  if (!/^[A-Za-z0-9_-]{32,96}$/.test(token)) return null
  const { data, error } = await db.rpc("shared_quote", { p_token: token })
  if (error) {
    console.warn("[quotes] shared_quote failed:", error.message)
    return null
  }
  if (!data) return null
  const s = data as SharedQuote
  // the document carries no server fields of its own; give the renderer what it expects
  return { ...s, document: { ...s.document, number: s.number, revision: s.revision, status: "draft", quote: { ...(s.document.quote ?? { kind: s.kind, title: "Quotation" }), kind: s.kind, validUntil: s.validUntil } } }
}

export async function trackSharedQuote(db: SupabaseClient, token: string) {
  const { data, error } = await db.rpc("track_shared_quote", { p_token: token })
  if (error) {
    console.warn("[quotes] track_shared_quote failed:", error.message)
    return null
  }
  return data as boolean | null
}

export function respondToQuote(db: SupabaseClient, args: { token: string; action: "accept" | "decline"; name: string | null; comment: string | null; ip: string | null; userAgent: string | null }) {
  return call<{ status: "accepted" | "declined"; respondedAt: string; name: string | null; comment: string | null; revision: number; expired: boolean; autoConverted: boolean }>(db, "respond_to_quote", {
    p_token: args.token,
    p_action: args.action,
    p_name: args.name,
    p_comment: args.comment,
    p_ip: args.ip,
    p_user_agent: args.userAgent,
  })
}
