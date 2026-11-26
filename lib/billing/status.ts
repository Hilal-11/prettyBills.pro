/**
 * What an invoice's status pill says. Derived, never stored, and evaluated in
 * this order (the database computes the same thing for its lists):
 *
 *   1 void → Void            5 part paid → Partially paid
 *   2 draft → Draft          6 opened by the client → Viewed
 *   3 paid in full → Paid    7 otherwise → Sent
 *   4 balance owed and past due (IST) → Overdue, with "Partially paid"
 *     as a second label when something has been received
 */

export type DisplayStatus = "void" | "draft" | "paid" | "overdue" | "partially_paid" | "viewed" | "sent"

export type StatusInput = {
  /** Stored lifecycle/money status: draft | sent | viewed | partially_paid | paid | void. */
  status: string
  total: number
  amountPaid: number
  dueDate: string | null | undefined
  viewedAt?: string | null
}

export function getDisplayStatus(inv: StatusInput, today: string): { status: DisplayStatus; secondary?: "partially_paid" } {
  if (inv.status === "void") return { status: "void" }
  if (inv.status === "draft") return { status: "draft" }
  const balance = inv.total - inv.amountPaid
  if (inv.total > 0 && balance <= 0) return { status: "paid" }
  if (balance > 0 && inv.dueDate && inv.dueDate < today) return inv.amountPaid > 0 ? { status: "overdue", secondary: "partially_paid" } : { status: "overdue" }
  if (inv.amountPaid > 0) return { status: "partially_paid" }
  if (inv.viewedAt || inv.status === "viewed") return { status: "viewed" }
  return { status: "sent" }
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  void: "Void",
  draft: "Draft",
  paid: "Paid",
  overdue: "Overdue",
  partially_paid: "Partially paid",
  viewed: "Viewed",
  sent: "Sent",
}
