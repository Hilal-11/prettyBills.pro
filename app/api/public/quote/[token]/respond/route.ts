import { after } from "next/server"

import { billingMessage } from "@/lib/billing/errors"
import { formatMoney, computeInvoiceTotals } from "@/lib/invoice/totals"
import { respondToQuote, sharedQuote } from "@/lib/server/db/quotes"
import { DbError } from "@/lib/server/db/util"
import { emailConfigured, sendEmail } from "@/lib/server/email"
import { json, publicOrigin } from "@/lib/server/http"
import { quoteResponseEmail } from "@/lib/server/invoice-email"
import { clientIp, rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * The client's Accept / Decline on /q/<token>. Rate limited (5 a minute per
 * IP); the database checks the token, the link, the status and that it's the
 * first answer, and stores the revision the client saw. The business is told
 * in-app (the activity log) and by email to the address printed on the quote,
 * which doesn't count toward the client email allowance.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = clientIp(request)
  const limit = rateLimit(`quote-respond:${ip}`, 5, 60_000)
  if (!limit.ok) return Response.json({ error: `Too many tries. Wait ${limit.retryAfter}s and try again.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } })
  if (!/^[A-Za-z0-9_-]{32,96}$/.test(token)) return json({ error: billingMessage("LINK_INACTIVE"), code: "LINK_INACTIVE" }, 404)

  const body = (await request.json().catch(() => null)) as { action?: unknown; name?: unknown; comment?: unknown; confirm?: unknown } | null
  const action = body?.action === "accept" ? "accept" : body?.action === "decline" ? "decline" : null
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : ""
  const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 1000) : ""
  if (!action) return json({ error: "Pick accept or decline." }, 400)
  if (action === "accept" && name.length < 2) return json({ error: billingMessage("NAME_REQUIRED"), code: "NAME_REQUIRED" }, 422)
  if (action === "accept" && body?.confirm !== true) return json({ error: "Tick the box to confirm you accept." }, 422)

  const db = await createClient()
  try {
    const res = await respondToQuote(db, { token, action, name: name || null, comment: comment || null, ip: ip === "local" ? null : ip, userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null })
    const origin = publicOrigin(request)
    const shared = await sharedQuote(db, token).catch(() => null)
    after(async () => {
      // after the answer is saved; a failed email never changes it
      const to = shared?.document.from.email
      if (!shared || !to || !EMAIL.test(to) || !emailConfigured()) return
      const mail = quoteResponseEmail({
        business: shared.document.from.name,
        number: shared.number,
        kind: shared.kind,
        action: res.status,
        name: res.name,
        comment: res.comment,
        amount: formatMoney(computeInvoiceTotals(shared.document).total, { whole: true }),
        expired: res.expired,
        link: `${origin}/quotes`,
        autoConverted: res.autoConverted,
      })
      await sendEmail({ fromName: "PrettyBills", to: [to], subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `quote-response-${token.slice(0, 24)}`, tags: [{ name: "kind", value: "quote_response" }] }).catch((e) =>
        console.warn("[quotes] owner notification failed:", (e as Error).message)
      )
    })
    return json({ ok: true, status: res.status, respondedAt: res.respondedAt, name: res.name, comment: res.comment })
  } catch (error) {
    if (error instanceof DbError && error.billing) return json({ error: billingMessage(error.billing, error.detail), code: error.billing }, error.billing === "LINK_INACTIVE" ? 404 : 409)
    console.error("[quotes] respond failed:", error instanceof Error ? error.message : error)
    return json({ error: "Something went wrong. Your answer wasn't saved. Try again." }, 500)
  }
}
