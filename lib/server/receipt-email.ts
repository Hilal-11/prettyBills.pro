import "server-only"

import { formatDate } from "@/lib/billing/dates"
import { MODE_LABEL } from "@/lib/billing/modes"
import { tdsLabel } from "@/lib/billing/tds"
import { formatINR } from "@/lib/billing/money"
import type { ReceiptView } from "@/lib/data/types"

/**
 * The "payment received" email: same frame as the invoice email (business
 * name, white card, summary table, one button), with the amount, a Paid in
 * full / Part payment pill and what's left on the invoice.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export function receiptSubject(view: ReceiptView) {
  const settled = view.payment.amount + view.payment.tdsPaise
  return view.payment.tdsPaise > 0 ? `Receipt ${view.receipt.number} – ${formatINR(settled)} settled for ${view.invoice.number}` : `Receipt ${view.receipt.number} – ${formatINR(view.payment.amount)} received for ${view.invoice.number}`
}

export function receiptEmail(view: ReceiptView, opts: { link?: string; attachedPdf: boolean; branding?: boolean }) {
  const { receipt, payment, invoice, balance } = view
  const business = invoice.from.name || "Your supplier"
  const client = invoice.billTo.name || "there"
  const amount = formatINR(payment.amount)
  const tds = payment.tdsPaise
  const settled = formatINR(payment.amount + tds)
  const pill = balance.paidInFull
    ? `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#e8f6ef;color:#12805c;font-size:12px;font-weight:600">Paid in full</span>`
    : `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#e9efff;color:#2453d6;font-size:12px;font-weight:600">Part payment</span>`
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#59636e">${esc(label)}</td><td align="right" style="padding:6px 0;font-size:${strong ? "15px" : "13px"};color:#1f2328;font-weight:${strong ? 700 : 500}">${esc(value)}</td></tr>`
  const intro = `Hi ${client}, thank you for your payment. ${tds > 0 ? `We've received ${amount}, and with your TDS of ${formatINR(tds)} that settles ${settled} of invoice ${invoice.number}.` : `We've received ${amount} for invoice ${invoice.number}.`}${balance.paidInFull ? " The invoice is now paid in full." : ` ${formatINR(balance.remaining)} is still due on it.`}`

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(`Receipt ${receipt.number}`)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${esc(`${business} received ${amount} for invoice ${invoice.number}.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 4px 16px;font-size:14px;font-weight:700;color:#1f2328">${esc(business)}</td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e3e5ea;border-radius:12px;padding:28px">
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2328">${esc(intro)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid #e3e5ea;border-radius:10px;background:#fafbfc">
      <tr><td style="padding:18px 20px">
        <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#59636e">Payment received</div>
        <div style="margin-top:4px;font-size:28px;font-weight:700;color:#1f2328">${esc(amount)}</div>
        <div style="margin-top:6px">${pill}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid #e3e5ea">
          ${row("Receipt", receipt.number)}
          ${row("Invoice", invoice.number)}
          ${row("Paid on", formatDate(payment.paidOn))}
          ${row("Mode", MODE_LABEL[payment.mode])}
          ${payment.reference ? row("Reference", payment.reference) : ""}
          ${tds > 0 ? row(`TDS deducted${payment.tdsSection ? ` (${tdsLabel(payment.tdsSection)})` : ""}`, formatINR(tds)) + row("Total settled", settled) : ""}
          ${row("Balance remaining", formatINR(balance.remaining), true)}
        </table>
        ${
          opts.link
            ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td style="border-radius:8px;background:#0061ff"><a href="${esc(opts.link)}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">View receipt</a></td></tr></table>`
            : ""
        }
        ${opts.attachedPdf ? `<div style="margin-top:14px;font-size:12px;color:#59636e">The receipt is attached as a PDF.</div>` : ""}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.5;color:#8b949e">
    Reply to this email to reach ${esc(business)}.${opts.branding === false ? "" : `<br>Sent with <a href="https://prettybill.in" style="color:#8b949e">PrettyBills</a>, free GST invoices.`}
  </td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = [
    intro,
    "",
    "—",
    `Receipt ${receipt.number}`,
    `Amount received: ${amount} (${balance.paidInFull ? "paid in full" : "part payment"})`,
    `Invoice: ${invoice.number}`,
    `Paid on: ${formatDate(payment.paidOn)}`,
    `Mode: ${MODE_LABEL[payment.mode]}${payment.reference ? ` · ${payment.reference}` : ""}`,
    ...(tds > 0 ? [`TDS deducted${payment.tdsSection ? ` (${tdsLabel(payment.tdsSection)})` : ""}: ${formatINR(tds)}`, `Total settled: ${settled}`] : []),
    `Balance remaining: ${formatINR(balance.remaining)}`,
    ...(opts.link ? [`View receipt: ${opts.link}`] : []),
    ...(opts.attachedPdf ? ["The receipt is attached as a PDF."] : []),
  ].join("\n")

  return { html, text }
}
