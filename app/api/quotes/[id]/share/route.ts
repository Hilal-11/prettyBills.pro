import { billingMessage } from "@/lib/billing/errors"
import { isQuoteKind } from "@/lib/billing/quotes"
import { getQuoteDocument, quoteShareLink, saveQuote, sendQuote } from "@/lib/server/db/quotes"
import { DbError, dbMessage, dbStatus } from "@/lib/server/db/util"
import { json, parseInvoice, publicOrigin } from "@/lib/server/http"
import { getSession } from "@/lib/server/session"

const UUID = /^[0-9a-f-]{36}$/

/**
 * The public link /q/<token>.
 * Body: { invoice?, kind?, key?, via?: "link" | "whatsapp", active? }.
 * Sharing a draft is sending it: the posted document is saved, checked
 * (client, items, valid until) and marked sent, so Viewed and Expired work.
 * `active` alone turns the link on or off.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return json({ error: "Your session has ended. Log in again." }, 401)
  const body = (await request.json().catch(() => null)) as { kind?: unknown; key?: unknown; via?: unknown; active?: unknown } | null
  const posted = parseInvoice(body)
  const via = body?.via === "whatsapp" ? "whatsapp" : "link"
  try {
    let current = await getQuoteDocument(session.db, id)
    if (typeof body?.active === "boolean" && !posted) {
      if (!current) return json({ error: "Save the quote first" }, 404)
      const q = await quoteShareLink(session.db, id, body.active)
      return json({ token: q.publicToken, url: `${publicOrigin(request)}/q/${q.publicToken}`, active: q.linkActive, quote: q })
    }
    if (posted && posted.id === id && (!current || current.summary.status === "draft") && isQuoteKind(body?.kind) && typeof body?.key === "string" && UUID.test(body.key)) {
      await saveQuote(session.db, posted, body.kind, body.key)
      current = await getQuoteDocument(session.db, id)
    }
    if (!current) return json({ error: "Save the quote first" }, 404)
    // copying the link again later doesn't count as another send
    const q = current.summary.status === "draft" ? await sendQuote(session.db, id, via) : await quoteShareLink(session.db, id, true)
    return json({ token: q.publicToken, url: `${publicOrigin(request)}/q/${q.publicToken}`, active: q.linkActive, quote: q })
  } catch (error) {
    if (error instanceof DbError && error.billing) return json({ error: billingMessage(error.billing, error.detail), code: error.billing }, 422)
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
