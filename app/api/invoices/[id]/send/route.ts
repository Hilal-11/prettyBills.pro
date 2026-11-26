import { createHash } from "node:crypto"

import { requireUserId } from "@/lib/auth/user"
import { pdfFilename } from "@/lib/invoice/format"
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice/totals"
import { validateInvoice } from "@/lib/invoice/validate"
import { hasFeature, upgradeHref } from "@/lib/pricing"
import { planSummary, recordEmailSend } from "@/lib/server/billing"
import { renderInvoicePdf } from "@/lib/server/pdf"
import { ensureShareLink, markSent, saveInvoice } from "@/lib/server/db/invoices"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { EmailError, emailConfigured, sendEmail } from "@/lib/server/email"
import { invoiceEmail } from "@/lib/server/invoice-email"
import { writeOutbox } from "@/lib/server/store"
import { createClient } from "@/lib/supabase/server"
import { json, originOf, parseInvoice, publicOrigin } from "@/lib/server/http"
import { rateLimit } from "@/lib/server/rate-limit"

type Body = {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  message: string
  attachPdf: boolean
  includeLink: boolean
  copyMe: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Sends the invoice by email.
 * - RESEND_API_KEY + INVOICE_FROM_EMAIL set: delivered through Resend.
 * - Otherwise in development: written to .data/outbox so the flow can be tested.
 * - Otherwise in production: refused with a clear error.
 * Signed-in owners only, so the route can't be used to send mail for strangers.
 * Emailing is a Pro feature: other plans get 402 with a link to /pricing, and
 * Pro has a monthly fair-use allowance (lib/pricing.ts).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  // protects the sender's reputation (and the email quota) from runaway sending
  const limit = rateLimit(`send:${auth.userId}`, 30, 60 * 60_000)
  if (!limit.ok) return Response.json({ error: `You've sent a lot of emails this hour. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } })
  const raw = (await request.json().catch(() => null)) as (Body & { invoice?: unknown }) | null
  const invoice = parseInvoice(raw)
  if (!raw || !invoice || invoice.id !== id) return json({ error: "Invalid request" }, 400)

  const recipients = [...(raw.to ?? []), ...(raw.cc ?? []), ...(raw.bcc ?? [])]
  if (!raw.to?.length || recipients.some((e) => !EMAIL.test(e))) return json({ error: "Check the email addresses" }, 422)
  if (recipients.length > 20) return json({ error: "Too many recipients" }, 422)

  const check = validateInvoice(invoice)
  if (check.requiredMissing > 0) return json({ error: `Fill ${check.requiredMissing} required field${check.requiredMissing === 1 ? "" : "s"} before sending`, firstInvalid: check.firstInvalid }, 422)

  // the plan is checked on the server; the editor's lock is only a hint
  const db = await createClient()
  const plan = await planSummary(db, auth.userId)
  if (plan.emails.limit === 0) {
    return json({ error: "Emailing invoices is part of PrettyBills Pro. You can still download the PDF or share a link for free.", code: "upgrade_required", upgrade: upgradeHref("email") }, 402)
  }
  if (plan.emails.used >= plan.emails.limit) {
    return json({ error: `You've sent ${plan.emails.limit.toLocaleString("en-IN")} invoice emails this month, the most your plan allows. The count starts again on the 1st.`, code: "email_limit" }, 429)
  }

  const configured = emailConfigured()
  if (!configured && process.env.NODE_ENV === "production") {
    return json({ error: "Email isn't set up yet. Add RESEND_API_KEY and INVOICE_FROM_EMAIL." }, 503)
  }

  const origin = originOf(request)
  let link: string | undefined
  let publicToken: string | undefined
  try {
    // the invoice is saved (and its link made) before anything leaves, so the link always works
    await saveInvoice(db, auth.userId, invoice)
    if (raw.includeLink) {
      const share = await ensureShareLink(db, id, true)
      publicToken = share?.token
      link = share ? `${publicOrigin(request)}/i/${share.token}` : undefined
    }
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }

  let attachment: { filename: string; content: string } | undefined
  if (raw.attachPdf) {
    try {
      const pdf = await renderInvoicePdf(invoice, origin)
      attachment = { filename: pdfFilename(invoice.number, invoice.billTo.name), content: Buffer.from(pdf).toString("base64") }
    } catch (error) {
      return json({ error: `Couldn't create the PDF: ${error instanceof Error ? error.message : "unknown error"}` }, 500)
    }
  }

  // files from the editor's "More" section travel with the email (not printed)
  const extra = invoice.attachments
    .map((a) => ({ filename: a.name, content: a.url.split(",")[1] ?? "" }))
    .filter((a) => a.content)
  const files = [...(attachment ? [attachment] : []), ...extra]

  const message = raw.message.replaceAll("{link}", link ?? "")
  const { html, text } = invoiceEmail(invoice, { message, link, attachedPdf: !!attachment, branding: !hasFeature(plan.id, "removeBranding") })
  const replyTo = invoice.from.email && EMAIL.test(invoice.from.email) ? invoice.from.email : undefined
  const bcc = [...new Set([...(raw.bcc ?? []), ...(raw.copyMe && replyTo ? [replyTo] : [])])]
  const subject = raw.subject.trim().slice(0, 300) || `Invoice ${invoice.number} from ${invoice.from.name}`

  let delivered = false
  let messageId: string | undefined
  if (configured) {
    // the same send within a minute (double click, retry) goes out once
    const key = createHash("sha256").update(JSON.stringify([id, raw.to, raw.cc, bcc, subject, Math.floor(Date.now() / 60_000)])).digest("hex").slice(0, 40)
    try {
      const sentEmail = await sendEmail({
        fromName: invoice.from.name,
        to: raw.to,
        cc: raw.cc,
        bcc,
        replyTo,
        subject,
        html,
        text,
        attachments: files,
        idempotencyKey: `invoice-${key}`,
        tags: [{ name: "kind", value: "invoice" }],
      })
      messageId = sentEmail.id
      delivered = true
    } catch (error) {
      // nothing went out, so the invoice stays as it was
      if (error instanceof EmailError) return json({ error: error.message }, error.status)
      throw error
    }
  } else {
    await writeOutbox({ to: raw.to, cc: raw.cc, bcc, subject, text, html, attachments: files.map((f) => ({ filename: f.filename, bytes: Math.round((f.content.length * 3) / 4) })) })
  }

  if (delivered) await recordEmailSend(db, auth.userId, { invoiceId: id, messageId, recipients: raw.to.length + (raw.cc?.length ?? 0) + bcc.length })

  const sent = await markSent(db, auth.userId, { ...invoice, publicToken: publicToken ?? invoice.publicToken, linkActive: raw.includeLink ? true : invoice.linkActive }, {
    to: raw.to.length + (raw.cc?.length ?? 0),
    ...(messageId ? { messageId } : { outbox: true }),
  }).catch((error) => error as Error)
  if (sent instanceof Error) return json({ error: `Sent, but couldn't update the invoice: ${dbMessage(sent)}` }, dbStatus(sent))
  const { sentAt, status } = sent
  const total = computeInvoiceTotals(invoice)

  return json({
    ok: true,
    delivered,
    sentAt,
    status,
    publicToken,
    summary: `${formatMoney(total.balanceDue, { whole: true })} to ${raw.to[0]}`,
  })
}
