import { requireUserId } from "@/lib/auth/user"
import { ensureShareLink, saveInvoice } from "@/lib/server/db/invoices"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { json, originOf, parseInvoice } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/**
 * Creates (once) the public link /i/<token> and sets whether it works.
 * Body: { invoice?, active? }. A posted invoice is saved first, so the link
 * shows exactly what's in the editor.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const body = (await request.json().catch(() => null)) as { active?: boolean } | null
  const posted = parseInvoice(body)
  const db = await createClient()
  try {
    if (posted && posted.id === id) await saveInvoice(db, auth.userId, posted)
    const link = await ensureShareLink(db, id, typeof body?.active === "boolean" ? body.active : undefined)
    if (!link) return json({ error: "Save the invoice first" }, 404)
    return json({ token: link.token, url: `${originOf(request)}/i/${link.token}`, active: link.active })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
