import { requireUserId } from "@/lib/auth/user"
import { pdfFilename } from "@/lib/invoice/format"
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice/totals"
import { validateInvoice } from "@/lib/invoice/validate"
import { renderInvoicePdf } from "@/lib/server/pdf"
import { ensureShareLink, markSent, saveInvoice } from "@/lib/server/db/invoices"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { writeOutbox } from "@/lib/server/store"
import { createClient } from "@/lib/supabase/server"
import { json, originOf, parseInvoice } from "@/lib/server/http"

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
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const raw = (await request.json().catch(() => null)) as (Body & { invoice?: unknown }) | null
  const invoice = parseInvoice(raw)
  if (!raw || !invoice || invoice.id !== id) return json({ error: "Invalid request" }, 400)

  const recipients = [...(raw.to ?? []), ...(raw.cc ?? []), ...(raw.bcc ?? [])]
  if (!raw.to?.length || recipients.some((e) => !EMAIL.test(e))) return json({ error: "Check the email addresses" }, 422)
  if (recipients.length > 20) return json({ error: "Too many recipients" }, 422)

  const check = validateInvoice(invoice)
  if (check.requiredMissing > 0) return json({ error: `Fill ${check.requiredMissing} required field${check.requiredMissing === 1 ? "" : "s"} before sending`, firstInvalid: check.firstInvalid }, 422)

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.INVOICE_FROM_EMAIL
  if ((!apiKey || !fromEmail) && process.env.NODE_ENV === "production") {
    return json({ error: "Email isn't set up yet. Add RESEND_API_KEY and INVOICE_FROM_EMAIL." }, 503)
  }

  const origin = originOf(request)
  const db = await createClient()
  let link: string | undefined
  let publicToken: string | undefined
  try {
    // the invoice is saved (and its link made) before anything leaves, so the link always works
    await saveInvoice(db, auth.userId, invoice)
    if (raw.includeLink) {
      const share = await ensureShareLink(db, id, true)
      publicToken = share?.token
      link = share ? `${origin}/i/${share.token}` : undefined
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

  const text = raw.message.replaceAll("{link}", link ?? "")
  const replyTo = invoice.from.email
  const bcc = [...(raw.bcc ?? []), ...(raw.copyMe && replyTo ? [replyTo] : [])]

  let delivered = false
  if (apiKey && fromEmail) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: `${invoice.from.name} <${fromEmail}>`,
        to: raw.to,
        cc: raw.cc?.length ? raw.cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        reply_to: replyTo || undefined,
        subject: raw.subject,
        text,
        attachments: files.length ? files : undefined,
      }),
    }).catch(() => null)
    if (!res?.ok) {
      const detail = res ? await res.text().catch(() => "") : "network error"
      return json({ error: `The email provider rejected the message (${detail.slice(0, 160)})` }, 502)
    }
    delivered = true
  } else {
    await writeOutbox({
      to: raw.to,
      cc: raw.cc,
      bcc,
      subject: raw.subject,
      text,
      attachments: files.map((f) => ({ filename: f.filename, bytes: Math.round((f.content.length * 3) / 4) })),
    })
  }

  const sent = await markSent(db, auth.userId, { ...invoice, publicToken: publicToken ?? invoice.publicToken, linkActive: raw.includeLink ? true : invoice.linkActive }).catch((error) => error as Error)
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
