/**
 * The rules for where an invoice sits and what its status becomes. Pure (no
 * imports), so the server, pages and tests share exactly one version.
 */

export type StoredStatus = "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "void"
export type Bucket = "draft" | "sent" | "overdue" | "paid" | "void"

/**
 * Every invoice is in exactly one bucket. Overdue isn't stored: it's an open
 * invoice (sent, viewed or part paid) whose due date has passed with money still owed.
 */
export function bucketOf(status: string, dueDate: string | null, balanceDue: number, today: string): Bucket {
  if (status === "draft") return "draft"
  if (status === "paid") return "paid"
  if (status === "void") return "void"
  return dueDate && dueDate < today && balanceDue > 0 ? "overdue" : "sent"
}

/**
 * Once an invoice has gone out, its status follows the money: fully paid →
 * paid, partly paid → partially paid, nothing paid → back to sent. Drafts and
 * void invoices keep their status whatever the amounts say.
 */
export function settleStatus(status: string, total: number, amountPaid: number): StoredStatus {
  const s = (status === "overdue" ? "sent" : status) as StoredStatus
  if (s === "draft" || s === "void") return s
  if (total > 0 && amountPaid >= total) return "paid"
  if (amountPaid > 0) return "partially_paid"
  return s === "paid" || s === "partially_paid" ? "sent" : s
}
