import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { todayIST } from "@/lib/billing/dates"
import { buildStatement, type Statement } from "@/lib/billing/ledger"
import { MODE_LABEL, isMode } from "@/lib/billing/modes"
import type { Client } from "@/lib/invoice/defaults"

import { DbError } from "./util"

/**
 * One client's balance and statement of account. Draft and void invoices
 * don't count; payments are the non-deleted ones. Outstanding always equals
 * billed − received, which equals the sum of the open invoices' balances.
 */

export type ClientBalance = { billed: number; received: number; outstanding: number; overdue: number; invoices: number; overdueInvoices: number }

export async function getClient(db: SupabaseClient, id: string): Promise<(Client & { updatedAt: string }) | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null
  const { data, error } = await db.from("clients").select("id, name, legal_name, gstin, pan, email, phone, website, address, updated_at").eq("id", id).maybeSingle()
  if (error) throw new DbError(error)
  if (!data) return null
  return {
    id: data.id,
    name: data.name,
    legalName: data.legal_name ?? undefined,
    gstin: data.gstin ?? undefined,
    pan: data.pan ?? undefined,
    email: data.email ?? undefined,
    phone: data.phone ?? undefined,
    website: data.website ?? undefined,
    address: { line1: "", city: "", stateCode: "", country: "India", ...(data.address as object) },
    updatedAt: data.updated_at,
  }
}

type InvoiceLedgerRow = { id: string; number: string; issue_date: string; due_date: string | null; total: number; amount_paid: number; balance_due: number; created_at: string }

async function ledgerInvoices(db: SupabaseClient, clientId: string) {
  const { data, error } = await db.from("invoices").select("id, number, issue_date, due_date, total, amount_paid, balance_due, created_at").eq("client_id", clientId).not("status", "in", "(draft,void)")
  if (error) throw new DbError(error)
  return data as InvoiceLedgerRow[]
}

export async function clientBalance(db: SupabaseClient, clientId: string): Promise<ClientBalance> {
  const today = todayIST()
  const rows = await ledgerInvoices(db, clientId)
  const b: ClientBalance = { billed: 0, received: 0, outstanding: 0, overdue: 0, invoices: rows.length, overdueInvoices: 0 }
  for (const r of rows) {
    b.billed += Number(r.total)
    b.received += Number(r.amount_paid)
    b.outstanding += Number(r.balance_due)
    if (r.due_date && r.due_date < today && Number(r.balance_due) > 0) {
      b.overdue += Number(r.balance_due)
      b.overdueInvoices++
    }
  }
  return b
}

export async function clientStatement(db: SupabaseClient, clientId: string, from: string, to: string): Promise<Statement> {
  const [invoices, payments] = await Promise.all([
    ledgerInvoices(db, clientId),
    db.from("payment_rows").select("id, invoice_id, invoice_number, paid_on, amount_paise, mode, reference, receipt_id, receipt_number, created_at").eq("client_id", clientId).is("deleted_at", null).not("invoice_status", "in", "(draft,void)"),
  ])
  if (payments.error) throw new DbError(payments.error)
  type P = { id: string; invoice_id: string; invoice_number: string; paid_on: string; amount_paise: number; mode: string; reference: string | null; receipt_id: string | null; receipt_number: string | null; created_at: string }
  return buildStatement({
    from,
    to,
    invoices: invoices.map((i) => ({ id: i.id, number: i.number, issueDate: i.issue_date, dueDate: i.due_date, total: Number(i.total), createdAt: i.created_at })),
    payments: (payments.data as P[]).map((p) => ({ id: p.id, invoiceId: p.invoice_id, invoiceNumber: p.invoice_number, paidOn: p.paid_on, amount: Number(p.amount_paise), mode: p.mode, reference: p.reference, receiptId: p.receipt_id, receiptNumber: p.receipt_number, createdAt: p.created_at })),
    describeMode: (m) => (isMode(m) ? MODE_LABEL[m] : m),
  })
}
