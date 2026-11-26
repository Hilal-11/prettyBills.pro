import { requireUserId } from "@/lib/auth/user"
import { listInvoicePayments } from "@/lib/server/db/payments"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/** An invoice's active payments, oldest first, with their receipts. For the editor's Payments card. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  if (!/^[\w-]{1,96}$/.test(id)) return json({ error: "Invalid invoice" }, 400)
  try {
    return json({ payments: await listInvoicePayments(await createClient(), id) })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
