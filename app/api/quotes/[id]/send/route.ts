import { createHash } from "node:crypto"

import { billingMessage } from "@/lib/billing/errors"
import { isQuoteKind, quoteLabel } from "@/lib/billing/quotes"
import { pdfFilename } from "@/lib/invoice/format"
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice/totals"
import { validateInvoice } from "@/lib/invoice/validate"
import { hasFeature, upgradeHref } from "@/lib/pricing"
import { planSummary, recordEmailSend } from "@/lib/server/billing"
import { getQuoteDocument, saveQuote, sendQuote } from "@/lib/server/db/quotes"
import { DbError, dbMessage, dbStatus } from "@/lib/server/db/util"
import { EmailError, emailConfigured, sendEmail } from "@/lib/server/email"
import { json, originOf, parseInvoice, publicOrigin } from "@/lib/server/http"
import { quoteEmail } from "@/lib/server/invoice-email"
import { renderInvoicePdf } from "@/lib/server/pdf"
import { rateLimit } from "@/lib/server/rate-limit"
import { getSession } from "@/lib/server/session"
import { writeOutbox } from "@/lib/server/store"

type Body = { to: string[]; cc?: string[]; bcc?: string[]; subject: string; message: string; attachPdf: boolean; includeLink: boolean; copyMe: boolean; kind?: unknown; key?: unknown }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const UUID = /^[0-9a-f-]{36}$/

/**
 * Emails a quote or proforma (same plan rules and allowance as invoices).
 * The draft is saved and marked sent in the database first (which checks
 * client, items and validity); the email goes out after that commits, and a
 * failed email never undoes it. Resend's idempotency key stops double sends.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return json({ error: "Your session has ended. Log in again." }, 401)
  const limit = rateLimit(`send:${session.userId}`, 30, 60 * 60_000)
  if (!limit.ok) return Response.json({ error: `You've sent a lot of emails this hour. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } })
  const raw = (await request.json().catch(() => null)) as (Body & { invoice?: unknown }) | null
  const posted = parseInvoice(raw)
  if (!raw || !posted || posted.id !== id) return json({ error: "Invalid request" }, 400)

  const recipients = [...(raw.to ?? []), ...(raw.cc ?? []), ...(raw.bcc ?? [])]
  if (!raw.to?.length || recipients.some((e) => !EMAIL.test(e))) return json({ error: "Check the email addresses" }, 422)
  if (recipients.length > 20) return json({ error: "Too many recipients" }, 422)

  const db = session.db
  const plan = await planSummary(db, session.userId)
  if (plan.emails.limit === 0) return json({ error: "Emailing is part of PrettyBills Pro. You can still download the PDF or share a link for free.", code: "upgrade_required", upgrade: upgradeHref("email") }, 402)
  if (plan.emails.used >= plan.emails.limit) return json({ error: `You've sent ${plan.emails.limit.toLocaleString("en-IN")} emails this month, the most your plan allows. The count starts again on the 1st.`, code: "email_limit" }, 429)
  const configured = emailConfigured()
  if (!configured && process.env.NODE_ENV === "production") return json({ error: "Email isn't set up yet. Add RESEND_API_KEY and INVOICE_FROM_EMAIL." }, 503)

  // 1. save (if still a draft) and mark sent: the database checks it's complete
  let doc = posted
  let token: string | null = null
  try {
    const current = await getQuoteDocument(db, id)
    if (!current || current.summary.status === "draft") {
      const check = validateInvoice(posted)
      if (check.requiredMissing > 0) return json({ error: `Fill ${check.requiredMissing} required field${check.requiredMissing === 1 ? "" : "s"} before sending`, firstInvalid: check.firstInvalid }, 422)
      if (!isQuoteKind(raw.kind) || typeof raw.key !== "string" || !UUID.test(raw.key)) return json({ error: "Invalid request" }, 400)
      await saveQuote(db, posted, raw.kind, raw.key)
    }
    const sent = await sendQuote(db, id, "email")
    token = sent.publicToken
    const fresh = await getQuoteDocument(db, id)
    if (fresh) doc = fresh.document
  } catch (error) {
    if (error instanceof DbError && error.billing) return json({ error: billingMessage(error.billing, error.detail), code: error.billing }, 422)
    return json({ error: dbMessage(error) }, dbStatus(error))
  }

  // 2. then the email (outside the database work)
  const link = raw.includeLink && token ? `${publicOrigin(request)}/q/${token}` : undefined
  let attachment: { filename: string; content: string } | undefined
  if (raw.attachPdf) {
    try {
      const pdf = await renderInvoicePdf(doc, originOf(request))
      attachment = { filename: pdfFilename(doc.number, doc.billTo.name), content: Buffer.from(pdf).toString("base64") }
    } catch (error) {
      return json({ error: `Marked as sent, but couldn't create the PDF: ${error instanceof Error ? error.message : "unknown error"}. Try sending again.` }, 500)
    }
  }
  const extra = doc.attachments.map((a) => ({ filename: a.name, content: a.url.split(",")[1] ?? "" })).filter((a) => a.content)
  const files = [...(attachment ? [attachment] : []), ...extra]
  const message = raw.message.replaceAll("{link}", link ?? "")
  const { html, text } = quoteEmail(doc, { message, link, attachedPdf: !!attachment, branding: !hasFeature(plan.id, "removeBranding") })
  const replyTo = doc.from.email && EMAIL.test(doc.from.email) ? doc.from.email : undefined
  const bcc = [...new Set([...(raw.bcc ?? []), ...(raw.copyMe && replyTo ? [replyTo] : [])])]
  const subject = raw.subject.trim().slice(0, 300) || `${doc.quote?.kind === "proforma" ? "Proforma invoice" : "Quotation"} ${doc.number} from ${doc.from.name}`

  let delivered = false
  if (configured) {
    const key = createHash("sha256").update(JSON.stringify([id, doc.revision, raw.to, raw.cc, bcc, subject, Math.floor(Date.now() / 60_000)])).digest("hex").slice(0, 40)
    try {
      const out = await sendEmail({ fromName: doc.from.name, to: raw.to, cc: raw.cc, bcc, replyTo, subject, html, text, attachments: files, idempotencyKey: `quote-${key}`, tags: [{ name: "kind", value: doc.quote?.kind ?? "quote" }] })
      delivered = true
      await recordEmailSend(db, session.userId, { invoiceId: id, messageId: out.id, recipients: raw.to.length + (raw.cc?.length ?? 0) + bcc.length })
    } catch (error) {
      // the quote stays sent (the link works); only the email failed
      if (error instanceof EmailError) return json({ error: `Marked as sent, but the email didn't go out: ${error.message}` }, error.status)
      throw error
    }
  } else {
    await writeOutbox({ to: raw.to, cc: raw.cc, bcc, subject, text, html, attachments: files.map((f) => ({ filename: f.filename, bytes: Math.round((f.content.length * 3) / 4) })) })
  }

  const total = computeInvoiceTotals(doc).total
  const fresh = await getQuoteDocument(db, id).catch(() => null)
  return json({ ok: true, delivered, quote: fresh?.summary ?? null, publicToken: token, summary: `${quoteLabel(doc.number, doc.revision)} · ${formatMoney(total, { whole: true })} to ${raw.to[0]}` })
}
