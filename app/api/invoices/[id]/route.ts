import { requireUserId } from "@/lib/auth/user"
import { getInvoice, saveInvoice } from "@/lib/server/db/invoices"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { json, parseInvoice } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  try {
    const invoice = await getInvoice(await createClient(), id)
    return invoice ? json({ invoice }) : json({ error: "Not found" }, 404)
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}

/** Autosave target. Creates the invoice on the first save; returns the stored status. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const invoice = parseInvoice(await request.json().catch(() => null))
  if (!invoice || invoice.id !== id) return json({ error: "Invalid invoice" }, 400)
  try {
    const saved = await saveInvoice(await createClient(), auth.userId, invoice)
    return json({ ok: true, ...saved })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
