import { timingSafeEqual } from "node:crypto"

import { addDays } from "@/lib/billing/dates"
import { quoteLabel } from "@/lib/billing/quotes"
import { formatDate } from "@/lib/invoice/format"
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice/totals"
import type { Invoice } from "@/lib/invoice/types"
import { getPlan, recordEmailSend } from "@/lib/server/billing"
import { today } from "@/lib/server/db/util"
import { emailConfigured, sendEmail } from "@/lib/server/email"
import { json, publicOrigin } from "@/lib/server/http"
import { quoteEmail } from "@/lib/server/invoice-email"
import { adminClient } from "@/lib/supabase/admin"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Pro: "quote expiring in 2 days" reminders to clients. Call once a day (any
 * scheduler) with `Authorization: Bearer $CRON_SECRET`. Only owners who turned
 * the setting on and are on Pro, only sent quotes still unanswered, once per
 * quote (reminded_at). Runs with the service role because it spans accounts.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return json({ error: "CRON_SECRET isn't set." }, 503)
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Unauthorized" }, 401)
  if (!emailConfigured()) return json({ error: "Email isn't set up." }, 503)

  const db = adminClient()
  const target = addDays(today(), 2)
  const { data: owners, error } = await db.from("workspace_settings").select("user_id").eq("quote_expiry_reminders", true).limit(5000)
  if (error) return json({ error: error.message }, 500)
  let sent = 0
  let skipped = 0
  for (const { user_id } of owners as { user_id: string }[]) {
    const plan = await getPlan(db, user_id)
    if (!plan.pro) {
      skipped++
      continue
    }
    const { data: quotes } = await db
      .from("quotes")
      .select("id, number, revision, public_token, data")
      .eq("user_id", user_id)
      .eq("kind", "quote")
      .eq("status", "sent")
      .eq("link_active", true)
      .eq("valid_until", target)
      .is("reminded_at", null)
      .limit(200)
    for (const q of (quotes ?? []) as { id: string; number: string; revision: number; public_token: string | null; data: Invoice }[]) {
      const doc: Invoice = { ...q.data, number: q.number, revision: q.revision }
      const to = doc.billTo.email
      if (!to || !EMAIL.test(to) || !q.public_token) {
        skipped++
        continue
      }
      const link = `${publicOrigin(request)}/q/${q.public_token}`
      const until = formatDate(target, doc.dateFormat)
      const amount = formatMoney(computeInvoiceTotals(doc).total, { whole: true })
      const label = quoteLabel(q.number, q.revision)
      const { html, text } = quoteEmail(doc, {
        message: `Hi ${doc.billTo.name},\n\nA quick reminder that our quotation ${label} for ${amount} is valid until ${until}. You can view and accept it online.\n\nThank you,\n${doc.signature?.signatoryName || doc.from.name}`,
        link,
        attachedPdf: false,
        branding: false,
      })
      try {
        const out = await sendEmail({
          fromName: doc.from.name,
          to: [to],
          replyTo: doc.from.email && EMAIL.test(doc.from.email) ? doc.from.email : undefined,
          subject: `Reminder: quotation ${label} is valid until ${until}`,
          html,
          text,
          idempotencyKey: `quote-reminder-${q.id}-${q.revision}`,
          tags: [{ name: "kind", value: "quote_reminder" }],
        })
        // after the email: mark it so tomorrow's run doesn't send it again
        await db.from("quotes").update({ reminded_at: new Date().toISOString() }).eq("id", q.id)
        await db.from("activities").insert({ user_id, entity_type: "quote", entity_id: q.id, client_id: doc.clientId || null, action: "quote.reminded", data: { to_count: 1, number: q.number } })
        await recordEmailSend(db, user_id, { invoiceId: q.id, messageId: out.id, recipients: 1 })
        sent++
      } catch (e) {
        console.warn(`[quotes] reminder for ${q.id} failed:`, (e as Error).message)
        skipped++
      }
    }
  }
  return json({ ok: true, date: target, sent, skipped })
}
