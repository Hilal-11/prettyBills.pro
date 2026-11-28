import { requireUserId } from "@/lib/auth/user"
import { listCreditNotes } from "@/lib/server/db/credit-notes"
import { listInvoicePayments } from "@/lib/server/db/payments"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/** An invoice's active payments (oldest first, with receipts) and its credit notes. For the editor's Payments card. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  if (!/^[\w-]{1,96}$/.test(id)) return json({ error: "Invalid invoice" }, 400)
  try {
    const db = await createClient()
    const [payments, notes] = await Promise.all([listInvoicePayments(db, id), listCreditNotes(db, { invoiceId: id }, { limit: 50 }).catch(() => ({ notes: [] }))])
    return json({ payments, creditNotes: notes.notes.map((n) => ({ id: n.id, number: n.number, date: n.date, reason: n.reason, total: n.total, status: n.status, unapplied: n.unapplied, refunded: n.refunded })) })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
