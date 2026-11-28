import { isQuoteKind } from "@/lib/billing/quotes"
import { getQuoteDocument, saveQuote } from "@/lib/server/db/quotes"
import { dbMessage, dbStatus, DbError } from "@/lib/server/db/util"
import { billingMessage } from "@/lib/billing/errors"
import { json, parseInvoice } from "@/lib/server/http"
import { getSession } from "@/lib/server/session"

const UUID = /^[0-9a-f-]{36}$/

/** The editor's load: the document and the quote's server state. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return json({ error: "Your session has ended. Log in again." }, 401)
  try {
    const found = await getQuoteDocument(session.db, id)
    return found ? json({ invoice: found.document, quote: found.summary }) : json({ error: "Not found" }, 404)
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}

/**
 * Autosave target. Creates the quote on the first save (the number comes from
 * the QT / PI series then) and updates it while it's a draft. A sent or
 * answered quote is refused: it changes only through Revise.
 * Body: { invoice, kind, key } where key is the first save's idempotency key.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return json({ error: "Your session has ended. Log in again." }, 401)
  const body = (await request.json().catch(() => null)) as { kind?: unknown; key?: unknown } | null
  const doc = parseInvoice(body)
  if (!doc || doc.id !== id || !isQuoteKind(body?.kind) || typeof body?.key !== "string" || !UUID.test(body.key)) return json({ error: "Invalid quote" }, 400)
  try {
    const quote = await saveQuote(session.db, doc, body.kind, body.key)
    return json({ ok: true, quote })
  } catch (error) {
    if (error instanceof DbError && error.billing) return json({ error: billingMessage(error.billing, error.detail), code: error.billing }, 409)
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
