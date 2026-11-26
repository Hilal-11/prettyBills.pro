/**
 * Read-side maths: a receipt's balance summary and a client's statement of
 * account. Nothing here is saved; balances that are stored come from the
 * database functions.
 */
import { formatDate } from "./dates.ts"
import type { Paise } from "./money.ts"

type Ordered = { id: string; paidOn: string; createdAt: string; amount: Paise }

/** Payment order everywhere: payment date, then when it was recorded, then id. */
export function comparePayments(a: Omit<Ordered, "amount">, b: Omit<Ordered, "amount">) {
  return a.paidOn.localeCompare(b.paidOn) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/**
 * For one receipt: what had been paid before it, this payment, and what's left.
 * `payments` are the invoice's active payments (deleted ones excluded).
 * Correct however the other payments are later edited, because it's worked
 * out when the receipt is shown.
 */
export function receiptBalance(payments: Ordered[], paymentId: string, total: Paise) {
  const sorted = [...payments].sort(comparePayments)
  const at = sorted.findIndex((p) => p.id === paymentId)
  const upTo = at === -1 ? sorted : sorted.slice(0, at)
  const paidBefore = upTo.reduce((s, p) => s + p.amount, 0)
  const thisPayment = at === -1 ? 0 : sorted[at].amount
  const remaining = Math.max(0, total - paidBefore - thisPayment)
  return { total, paidBefore, thisPayment, remaining, paidInFull: remaining === 0 }
}

export type LedgerInvoice = { id: string; number: string; issueDate: string; dueDate?: string | null; total: Paise; createdAt: string }
export type LedgerPayment = { id: string; invoiceId: string; invoiceNumber: string; paidOn: string; amount: Paise; mode: string; reference?: string | null; receiptId?: string | null; receiptNumber?: string | null; createdAt: string }

export type StatementRow =
  | { kind: "invoice"; date: string; id: string; number: string; description: string; debit: Paise; credit: 0; balance: Paise }
  | { kind: "payment"; date: string; id: string; number: string; description: string; debit: 0; credit: Paise; balance: Paise; invoiceId: string; receiptId?: string | null }

type WithoutBalance = StatementRow extends infer R ? (R extends StatementRow ? Omit<R, "balance"> : never) : never

export type Statement = { from: string; to: string; opening: Paise; invoiced: Paise; received: Paise; closing: Paise; rows: StatementRow[] }

/**
 * Statement of account for one client over [from, to]. Invoices are debits,
 * payments credits. Everything dated before `from` rolls into the opening
 * balance. Same-day rows: invoices first, then payments, then by when they
 * were recorded. Draft and void invoices must already be left out.
 */
export function buildStatement(opts: { invoices: LedgerInvoice[]; payments: LedgerPayment[]; from: string; to: string; describeMode?: (mode: string) => string }): Statement {
  const { from, to } = opts
  const describe = opts.describeMode ?? ((m: string) => m)
  type Entry = { date: string; order: 0 | 1; createdAt: string; row: WithoutBalance }
  const entries: Entry[] = []
  let opening = 0

  for (const inv of opts.invoices) {
    if (inv.issueDate < from) opening += inv.total
    else if (inv.issueDate <= to)
      entries.push({ date: inv.issueDate, order: 0, createdAt: inv.createdAt, row: { kind: "invoice", date: inv.issueDate, id: inv.id, number: inv.number, description: inv.dueDate ? `Invoice, due ${formatDate(inv.dueDate)}` : "Invoice", debit: inv.total, credit: 0 } })
  }
  for (const p of opts.payments) {
    if (p.paidOn < from) opening -= p.amount
    else if (p.paidOn <= to)
      entries.push({
        date: p.paidOn,
        order: 1,
        createdAt: p.createdAt,
        row: { kind: "payment", date: p.paidOn, id: p.id, number: p.receiptNumber || "—", description: `${describe(p.mode)}${p.reference ? ` · ${p.reference}` : ""} · against ${p.invoiceNumber}`, debit: 0, credit: p.amount, invoiceId: p.invoiceId, receiptId: p.receiptId },
      })
  }

  entries.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.createdAt.localeCompare(b.createdAt))
  let balance = opening
  let invoiced = 0
  let received = 0
  const rows = entries.map((e) => {
    balance += e.row.debit - e.row.credit
    invoiced += e.row.debit
    received += e.row.credit
    return { ...e.row, balance } as StatementRow
  })
  return { from, to, opening, invoiced, received, closing: balance, rows }
}
