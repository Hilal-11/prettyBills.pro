import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { formatINR } from "@/lib/billing/money"
import type { ReceiptView } from "@/lib/data/types"
import { pdfFilename } from "@/lib/invoice/format"
import { hasFeature } from "@/lib/pricing"

import { planSummary, recordEmailSend } from "./billing"
import { getReceiptView, noteReceiptEvent } from "./db/payments"
import { EmailError, emailConfigured, sendEmail } from "./email"
import { renderReceiptPdf } from "./pdf"
import { receiptEmail, receiptSubject } from "./receipt-email"
import { writeOutbox } from "./store"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type ReceiptEmailOutcome =
  | { status: "sent"; to: string; outbox?: boolean }
  | { status: "upgrade" | "limit" | "no_email" | "not_configured"; message: string }
  | { status: "failed"; message: string }

export const receiptLink = (origin: string, token: string) => `${origin}/r/${token}`

/** WhatsApp message and link for a receipt. */
export function receiptShare(view: ReceiptView, link: string) {
  const text = `Hi ${view.invoice.billTo.name || "there"}, we've received ${formatINR(view.payment.amount)} for invoice ${view.invoice.number}. Thank you! Receipt: ${link}`
  const digits = (view.invoice.billTo.phone ?? "").replace(/\D/g, "")
  const phone = digits.length === 10 ? `91${digits}` : digits.length >= 11 ? digits : ""
  return { text, whatsapp: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` }
}

/**
 * Emails a receipt to the client. Runs after the payment is saved, never
 * inside its transaction: a failed email never loses a payment.
 *
 * `manual`: someone clicked Email receipt. `auto`: sent as part of recording
 * the payment. Both need emailing in the plan (Pro) and count toward the
 * monthly allowance. The Resend idempotency key makes a retry of the same
 * send (double click, network retry) go out once.
 */
export async function sendReceiptEmail(
  db: SupabaseClient,
  userId: string,
  receiptId: string,
  opts: { triggeredBy: "manual" | "auto"; origin: string; publicOrigin: string; to?: string }
): Promise<ReceiptEmailOutcome> {
  const view = await getReceiptView(db, receiptId)
  if (!view || view.receipt.status !== "active") return { status: "failed", message: "This receipt is void or no longer exists." }

  const plan = await planSummary(db, userId)
  if (plan.emails.limit === 0) return { status: "upgrade", message: "Emailing receipts is part of PrettyBills Pro. Share it on WhatsApp or copy the link instead, free." }
  if (plan.emails.used >= plan.emails.limit) return { status: "limit", message: `You've sent ${plan.emails.limit.toLocaleString("en-IN")} emails this month, the most your plan allows. Share the link instead.` }

  const to = (opts.to ?? view.invoice.billTo.email ?? "").trim()
  if (!EMAIL.test(to)) return { status: "no_email", message: "This client has no email address. Add one to the client, or share the receipt on WhatsApp." }

  const configured = emailConfigured()
  if (!configured && process.env.NODE_ENV === "production") return { status: "not_configured", message: "Email isn't set up yet. Add RESEND_API_KEY and INVOICE_FROM_EMAIL." }

  const link = view.receipt.publicToken ? receiptLink(opts.publicOrigin, view.receipt.publicToken) : undefined
  try {
    const pdf = await renderReceiptPdf(view, opts.origin)
    const attachment = { filename: pdfFilename(view.receipt.number, view.invoice.billTo.name), content: Buffer.from(pdf).toString("base64") }
    const { html, text } = receiptEmail(view, { link, attachedPdf: true, branding: !hasFeature(plan.id, "removeBranding") })
    const replyTo = view.invoice.from.email && EMAIL.test(view.invoice.from.email) ? view.invoice.from.email : undefined
    const subject = receiptSubject(view)

    if (!configured) {
      await writeOutbox({ to: [to], subject, text, html, attachments: [{ filename: attachment.filename, bytes: pdf.byteLength }] })
      await noteReceiptEvent(db, receiptId, "receipt.emailed", { to: [to], outbox: true, triggered_by: opts.triggeredBy })
      return { status: "sent", to, outbox: true }
    }

    // a retry of this exact send reuses the key; a deliberate resend later gets a new one
    const sends = await db.from("receipts").select("email_count").eq("id", receiptId).single()
    const nth = sends.data?.email_count ?? 0
    const sent = await sendEmail({
      fromName: view.invoice.from.name,
      to: [to],
      replyTo,
      subject,
      html,
      text,
      attachments: [attachment],
      idempotencyKey: `receipt-${receiptId}-rev${view.receipt.revision}-${opts.triggeredBy}-${nth}`,
      tags: [{ name: "kind", value: "receipt" }],
    })
    await recordEmailSend(db, userId, { invoiceId: view.invoice.id, messageId: sent.id, recipients: 1 })
    await noteReceiptEvent(db, receiptId, "receipt.emailed", { to: [to], message_id: sent.id, triggered_by: opts.triggeredBy })
    return { status: "sent", to }
  } catch (error) {
    const message = error instanceof EmailError ? error.message : error instanceof Error ? error.message : "The email couldn't be sent."
    console.error(`[receipts] email failed for receipt ${receiptId}:`, message)
    await noteReceiptEvent(db, receiptId, "receipt.email_failed", { error: message.slice(0, 300), triggered_by: opts.triggeredBy })
    return { status: "failed", message }
  }
}
