import "server-only"

import { formatDate } from "@/lib/invoice/format"
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice/totals"
import type { Invoice } from "@/lib/invoice/types"

/**
 * The email a client receives: the sender's own message, then a summary card
 * (amount, due date, a button to the invoice, how to pay). Table layout and
 * inline styles, because that's what email clients render reliably. The
 * plain-text part carries the same information for clients that block HTML.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

/** Plain text → paragraphs, with bare links made clickable. */
function paragraphs(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const html = esc(block)
        .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#0061ff;text-decoration:underline">${url}</a>`)
        .replace(/\n/g, "<br>")
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2328">${html}</p>`
    })
    .join("")
}

/** `branding: false` (Pro) drops the "Sent with PrettyBills" line. */
export function invoiceEmail(invoice: Invoice, opts: { message: string; link?: string; attachedPdf: boolean; branding?: boolean }) {
  const totals = computeInvoiceTotals(invoice)
  const paid = invoice.status === "paid" || totals.balanceDue <= 0
  const amount = formatMoney(paid ? totals.total : totals.balanceDue)
  const due = invoice.dueDate ? formatDate(invoice.dueDate, invoice.dateFormat) : null
  const business = invoice.from.name || "Your supplier"
  const upi = !paid && invoice.payment.showUpiQr && invoice.payment.upiId ? invoice.payment.upiId : null
  const bank = !paid && invoice.payment.showBank && invoice.payment.bank?.accountNumber ? invoice.payment.bank : null

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#59636e">${esc(label)}</td><td align="right" style="padding:6px 0;font-size:${strong ? "15px" : "13px"};color:#1f2328;font-weight:${strong ? 700 : 500}">${esc(value)}</td></tr>`

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(`Invoice ${invoice.number}`)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${esc(`${business} sent you invoice ${invoice.number} for ${amount}${due && !paid ? `, due ${due}` : ""}.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 4px 16px;font-size:14px;font-weight:700;color:#1f2328">${esc(business)}</td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e3e5ea;border-radius:12px;padding:28px">
    ${paragraphs(opts.message)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid #e3e5ea;border-radius:10px;background:#fafbfc">
      <tr><td style="padding:18px 20px">
        <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#59636e">${paid ? "Paid" : "Amount due"}</div>
        <div style="margin-top:4px;font-size:28px;font-weight:700;color:#1f2328">${esc(amount)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid #e3e5ea">
          ${row("Invoice", invoice.number)}
          ${row("Issued", formatDate(invoice.issueDate, invoice.dateFormat))}
          ${due && !paid ? row("Due", due) : ""}
          ${upi ? row("UPI", upi) : ""}
          ${bank ? row("Bank", `${bank.bankName ? `${bank.bankName} · ` : ""}A/c ${bank.accountNumber} · IFSC ${bank.ifsc}`) : ""}
        </table>
        ${
          opts.link
            ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td style="border-radius:8px;background:#0061ff"><a href="${esc(opts.link)}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${paid ? "View invoice" : upi ? "View and pay" : "View invoice"}</a></td></tr></table>`
            : ""
        }
        ${opts.attachedPdf ? `<div style="margin-top:14px;font-size:12px;color:#59636e">The invoice is attached as a PDF.</div>` : ""}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.5;color:#8b949e">
    Reply to this email to reach ${esc(business)}.${opts.branding === false ? "" : `<br>Sent with <a href="https://prettybill.in" style="color:#8b949e">PrettyBills</a>, free GST invoices.`}
  </td></tr>
</table>
</td></tr></table>
</body></html>`

  const lines = [
    opts.message.trim(),
    "",
    "—",
    `Invoice ${invoice.number}`,
    `${paid ? "Paid" : "Amount due"}: ${amount}`,
    ...(due && !paid ? [`Due: ${due}`] : []),
    ...(upi ? [`Pay by UPI: ${upi}`] : []),
    ...(bank ? [`Bank: ${bank.bankName ? `${bank.bankName}, ` : ""}A/c ${bank.accountNumber}, IFSC ${bank.ifsc}`] : []),
    ...(opts.link && !opts.message.includes(opts.link) ? [`View invoice: ${opts.link}`] : []),
    ...(opts.attachedPdf ? ["The invoice is attached as a PDF."] : []),
  ]
  return { html, text: lines.join("\n") }
}
