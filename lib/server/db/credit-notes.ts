import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { CnDoc, PriorCredit } from "@/lib/billing/credit-notes"
import type { PaymentMode } from "@/lib/billing/modes"
import type { Invoice, PartySnapshot } from "@/lib/invoice/types"

import { getInvoice } from "./invoices"
import { DbError } from "./util"

/**
 * Credit notes in Postgres. Every write is one call to a database function
 * (save_credit_note_draft, create_and_issue_credit_note, issue_credit_note,
 * apply_client_credit, record_refund, delete_refund, void_credit_note) that
 * locks, checks and recomputes in one transaction. Reads go through RLS.
 */

export type CreditNoteStatus = "draft" | "issued" | "void"

export type CreditNote = {
  id: string
  number: string | null
  date: string
  status: CreditNoteStatus
  reason: string
  reasonText: string | null
  mode: "items" | "lump_sum"
  invoiceId: string
  invoiceNumber: string
  invoiceDate: string
  clientId: string | null
  clientName: string
  from: Invoice["from"]
  billTo: PartySnapshot
  placeOfSupply: string
  supplyType: string
  taxType: "igst" | "cgst_sgst" | "none"
  taxable: number
  cgst: number
  sgst: number
  igst: number
  roundOff: number
  total: number
  applied: number
  refunded: number
  unapplied: number
  lateForGst: boolean
  templateId: string
  pageColor: "white" | "black"
  notes: string | null
  publicToken: string | null
  linkActive: boolean
  issuedAt: string | null
  voidedAt: string | null
  voidReason: string | null
  createdAt: string
}

export type CreditNoteItem = { id: string; invoiceItemId: string | null; name: string; description: string | null; hsnSac: string | null; qty: number; unit: string | null; rate: number; taxable: number; taxRate: number; tax: number; total: number }
export type CreditAllocation = { id: string; invoiceId: string; invoiceNumber: string; amount: number; appliedOn: string; reversedAt: string | null }
export type Refund = { id: string; amount: number; refundedOn: string; mode: PaymentMode; reference: string | null; note: string | null; deletedAt: string | null }

export type CreditNoteDetail = CreditNote & { items: CreditNoteItem[]; allocations: CreditAllocation[]; refunds: Refund[] }

type Row = Record<string, unknown>
const num = (v: unknown) => Number(v ?? 0)
const str = (v: unknown) => (typeof v === "string" ? v : null)

export function toCreditNote(r: Row): CreditNote {
  const billTo = (r.bill_to_snapshot ?? {}) as PartySnapshot
  return {
    id: r.id as string,
    number: str(r.number),
    date: r.cn_date as string,
    status: r.status as CreditNoteStatus,
    reason: r.reason as string,
    reasonText: str(r.reason_text),
    mode: r.mode as "items" | "lump_sum",
    invoiceId: r.invoice_id as string,
    invoiceNumber: r.original_invoice_number as string,
    invoiceDate: r.original_invoice_date as string,
    clientId: str(r.client_id),
    clientName: billTo.name ?? "",
    from: (r.from_snapshot ?? {}) as Invoice["from"],
    billTo,
    placeOfSupply: (r.place_of_supply as string) ?? "",
    supplyType: (r.supply_type as string) ?? "",
    taxType: r.tax_type as CreditNote["taxType"],
    taxable: num(r.taxable_paise),
    cgst: num(r.cgst_paise),
    sgst: num(r.sgst_paise),
    igst: num(r.igst_paise),
    roundOff: num(r.round_off_paise),
    total: num(r.total_paise),
    applied: num(r.applied_paise),
    refunded: num(r.refunded_paise),
    unapplied: num(r.unapplied_paise),
    lateForGst: !!r.is_late_for_gst,
    templateId: (r.template_id as string) ?? "standard",
    pageColor: r.page_color === "black" ? "black" : "white",
    notes: str(r.notes),
    publicToken: str(r.public_token),
    linkActive: !!r.link_active,
    issuedAt: str(r.issued_at),
    voidedAt: str(r.voided_at),
    voidReason: str(r.void_reason),
    createdAt: r.created_at as string,
  }
}

export const toItem = (r: Row): CreditNoteItem => ({
  id: r.id as string,
  invoiceItemId: str(r.invoice_item_id),
  name: r.name as string,
  description: str(r.description),
  hsnSac: str(r.hsn_sac),
  qty: Number(r.qty),
  unit: str(r.unit),
  rate: num(r.rate_paise),
  taxable: num(r.taxable_paise),
  taxRate: num(r.tax_rate_bp) / 100,
  tax: num(r.tax_paise),
  total: num(r.total_paise),
})

const COLUMNS = "*"

/* --------------------------------- reads --------------------------------- */

/** Everything the editor needs about the invoice being credited. */
export async function creditContext(db: SupabaseClient, invoiceId: string) {
  const [invoice, row, issued] = await Promise.all([
    getInvoice(db, invoiceId),
    db.from("invoices").select("id, number, issue_date, total, amount_paid, credited_paise, balance_due, status, client_id, cancelled").eq("id", invoiceId).maybeSingle(),
    db.from("credit_notes").select("id, total_paise, credit_note_items(invoice_item_id, taxable_paise)").eq("invoice_id", invoiceId).eq("status", "issued"),
  ])
  if (row.error) throw new DbError(row.error)
  if (issued.error) throw new DbError(issued.error)
  if (!invoice || !row.data) return null
  const prior: PriorCredit = { lines: {}, total: 0 }
  for (const n of issued.data as { total_paise: number; credit_note_items: { invoice_item_id: string | null; taxable_paise: number }[] }[]) {
    prior.total += Number(n.total_paise)
    for (const i of n.credit_note_items ?? []) if (i.invoice_item_id) prior.lines[i.invoice_item_id] = (prior.lines[i.invoice_item_id] ?? 0) + Number(i.taxable_paise)
  }
  const r = row.data
  return {
    invoice,
    prior,
    summary: { id: r.id as string, number: r.number as string, issueDate: r.issue_date as string, total: Number(r.total), paid: Number(r.amount_paid), credited: Number(r.credited_paise), balance: Number(r.balance_due), status: r.status as string, clientId: (r.client_id as string | null) ?? null, cancelled: !!r.cancelled },
  }
}

export type CreditNoteFilters = { status?: CreditNoteStatus | "unapplied" | "all"; q?: string; clientId?: string; invoiceId?: string }

/** One page of credit notes, newest first, plus whether there are more. */
export async function listCreditNotes(db: SupabaseClient, f: CreditNoteFilters, opts: { limit?: number; offset?: number } = {}) {
  const limit = opts.limit ?? 50
  const from = opts.offset ?? 0
  let q = db.from("credit_notes").select(COLUMNS, { count: "exact" })
  if (f.status === "unapplied") q = q.eq("status", "issued").gt("unapplied_paise", 0)
  else if (f.status && f.status !== "all") q = q.eq("status", f.status)
  if (f.clientId) q = q.eq("client_id", f.clientId)
  if (f.invoiceId) q = q.eq("invoice_id", f.invoiceId)
  const t = f.q?.trim().replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()"]/g, " ")
  if (t) q = q.or(`number.ilike.%${t}%,original_invoice_number.ilike.%${t}%,bill_to_snapshot->>name.ilike.%${t}%`)
  const { data, error, count } = await q.order("cn_date", { ascending: false }).order("created_at", { ascending: false }).range(from, from + limit - 1)
  if (error) throw new DbError(error)
  return { notes: (data as Row[]).map(toCreditNote), total: count ?? 0 }
}

/** Counts per status tab. */
export async function creditNoteCounts(db: SupabaseClient) {
  const base = () => db.from("credit_notes").select("id", { count: "exact", head: true })
  const [all, draft, issued, unapplied, voided] = await Promise.all([base(), base().eq("status", "draft"), base().eq("status", "issued"), base().eq("status", "issued").gt("unapplied_paise", 0), base().eq("status", "void")])
  for (const r of [all, draft, issued, unapplied, voided]) if (r.error) throw new DbError(r.error)
  return { all: all.count ?? 0, draft: draft.count ?? 0, issued: issued.count ?? 0, unapplied: unapplied.count ?? 0, void: voided.count ?? 0 }
}

export async function getCreditNote(db: SupabaseClient, id: string): Promise<CreditNoteDetail | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const [note, items, allocs, refunds] = await Promise.all([
    db.from("credit_notes").select(COLUMNS).eq("id", id).maybeSingle(),
    db.from("credit_note_items").select("*").eq("credit_note_id", id).order("position"),
    db.from("credit_allocations").select("id, invoice_id, amount_paise, applied_on, reversed_at, invoices(number)").eq("credit_note_id", id).order("created_at"),
    db.from("refunds").select("id, amount_paise, refunded_on, mode, reference, note, deleted_at").eq("credit_note_id", id).order("created_at"),
  ])
  for (const r of [note, items, allocs, refunds]) if (r.error) throw new DbError(r.error)
  if (!note.data) return null
  return {
    ...toCreditNote(note.data as Row),
    items: (items.data as Row[]).map(toItem),
    allocations: (allocs.data as Row[]).map((a) => {
      const inv = (Array.isArray(a.invoices) ? a.invoices[0] : a.invoices) as { number: string } | null
      return { id: a.id as string, invoiceId: a.invoice_id as string, invoiceNumber: inv?.number ?? "", amount: num(a.amount_paise), appliedOn: a.applied_on as string, reversedAt: str(a.reversed_at) }
    }),
    refunds: (refunds.data as Row[]).map((r) => ({ id: r.id as string, amount: num(r.amount_paise), refundedOn: r.refunded_on as string, mode: r.mode as PaymentMode, reference: str(r.reference), note: str(r.note), deletedAt: str(r.deleted_at) })),
  }
}

/** Issued notes of one client with credit still to use (client page, Record payment). */
export async function clientCredits(db: SupabaseClient, clientId: string) {
  const { data, error } = await db.from("credit_notes").select(COLUMNS).eq("client_id", clientId).eq("status", "issued").gt("unapplied_paise", 0).order("cn_date")
  if (error) throw new DbError(error)
  return (data as Row[]).map(toCreditNote)
}

/** Unapplied credit across all clients (dashboard). */
export async function totalClientCredit(db: SupabaseClient) {
  const { data, error } = await db.from("credit_notes").select("unapplied_paise").eq("status", "issued").gt("unapplied_paise", 0).limit(5000)
  if (error) throw new DbError(error)
  return (data as { unapplied_paise: number }[]).reduce((s, r) => s + Number(r.unapplied_paise), 0)
}

/** For /cn/<token>: the issued note and its lines, signed out, while the link is on. */
export async function sharedCreditNote(db: SupabaseClient, token: string): Promise<CreditNoteDetail | null> {
  if (!/^[A-Za-z0-9_-]{32,96}$/.test(token)) return null
  const { data, error } = await db.rpc("shared_credit_note", { p_token: token })
  if (error || !data) return null
  const d = data as { credit_note: Row; items: Row[] }
  return { ...toCreditNote(d.credit_note), items: (d.items ?? []).map(toItem), allocations: [], refunds: [] }
}

/* --------------------------------- writes -------------------------------- */

type Result = { creditNote: CreditNote; invoice: { id: string; number: string; balanceDue: number; status: string; cancelled: boolean }; replayed?: boolean }

async function call(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<Result> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw new DbError(error)
  const d = data as { credit_note: Row; invoice: Row; replayed?: boolean }
  return { creditNote: toCreditNote(d.credit_note), invoice: { id: d.invoice.id as string, number: d.invoice.number as string, balanceDue: num(d.invoice.balance_due), status: d.invoice.status as string, cancelled: !!d.invoice.cancelled }, replayed: d.replayed }
}

export const saveCreditNoteDraft = (db: SupabaseClient, id: string | null, invoiceId: string, doc: CnDoc, key: string) => call(db, "save_credit_note_draft", { p_id: id, p_invoice_id: invoiceId, p_doc: doc, p_idempotency_key: key })
export const createAndIssueCreditNote = (db: SupabaseClient, id: string | null, invoiceId: string, doc: CnDoc, key: string) => call(db, "create_and_issue_credit_note", { p_id: id, p_invoice_id: invoiceId, p_doc: doc, p_idempotency_key: key })
export const voidCreditNote = (db: SupabaseClient, id: string, reason: string) => call(db, "void_credit_note", { p_id: id, p_reason: reason })
export const applyClientCredit = (db: SupabaseClient, id: string, invoiceId: string, amount: number, key: string) => call(db, "apply_client_credit", { p_credit_note_id: id, p_invoice_id: invoiceId, p_amount_paise: amount, p_idempotency_key: key })
export const recordRefund = (db: SupabaseClient, id: string, r: { amount: number; refundedOn: string; mode: PaymentMode; reference?: string; note?: string; key: string }) =>
  call(db, "record_refund", { p_credit_note_id: id, p_amount_paise: r.amount, p_refunded_on: r.refundedOn, p_mode: r.mode, p_reference: r.reference ?? null, p_note: r.note ?? null, p_idempotency_key: r.key })
export const deleteRefund = (db: SupabaseClient, refundId: string, reason: string) => call(db, "delete_refund", { p_refund_id: refundId, p_reason: reason })

export async function deleteCreditNoteDraft(db: SupabaseClient, id: string) {
  const { error } = await db.rpc("delete_credit_note_draft", { p_id: id })
  if (error) throw new DbError(error)
}
