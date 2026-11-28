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

/* ------------------------------ quotes & proformas ------------------------------ */

/**
 * A quote or proforma for the client: same look as the invoice email, with
 * the total as the hero, a "Valid until" pill and a button to view (and, for
 * quotes, accept) it online.
 */
export function quoteEmail(doc: Invoice, opts: { message: string; link?: string; attachedPdf: boolean; branding?: boolean }) {
  const totals = computeInvoiceTotals(doc)
  const kind = doc.quote?.kind ?? "quote"
  const word = kind === "proforma" ? "Proforma invoice" : doc.quote?.title === "Estimate" ? "Estimate" : "Quotation"
  const amount = formatMoney(totals.total)
  const until = doc.quote?.validUntil ? formatDate(doc.quote.validUntil, doc.dateFormat) : null
  const business = doc.from.name || "Your supplier"
  const number = doc.revision > 1 ? `${doc.number} (Rev ${doc.revision})` : doc.number
  const upi = kind === "proforma" && doc.payment.showUpiQr && doc.payment.upiId ? doc.payment.upiId : null
  const bank = kind === "proforma" && doc.payment.showBank && doc.payment.bank?.accountNumber ? doc.payment.bank : null
  const button = kind === "quote" ? "View &amp; accept quote" : "View proforma"
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#59636e">${esc(label)}</td><td align="right" style="padding:6px 0;font-size:13px;color:#1f2328;font-weight:500">${esc(value)}</td></tr>`

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(`${word} ${number}`)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${esc(`${business} sent you ${word.toLowerCase()} ${number} for ${amount}${until ? `, valid until ${until}` : ""}.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 4px 16px;font-size:14px;font-weight:700;color:#1f2328">${esc(business)}</td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e3e5ea;border-radius:12px;padding:28px">
    ${paragraphs(opts.message)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid #e3e5ea;border-radius:10px;background:#fafbfc">
      <tr><td style="padding:18px 20px">
        <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#59636e">${esc(word)} total</div>
        <div style="margin-top:4px;font-size:28px;font-weight:700;color:#1f2328">${esc(amount)}</div>
        ${until ? `<div style="margin-top:8px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#eaf1ff;color:#0047bb;font-size:12px;font-weight:600">Valid until ${esc(until)}</span></div>` : ""}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid #e3e5ea">
          ${row(word, number)}
          ${row("Issued", formatDate(doc.issueDate, doc.dateFormat))}
          ${row("Items", String(doc.items.length))}
          ${upi ? row("UPI", upi) : ""}
          ${bank ? row("Bank", `${bank.bankName ? `${bank.bankName} · ` : ""}A/c ${bank.accountNumber} · IFSC ${bank.ifsc}`) : ""}
        </table>
        ${
          opts.link
            ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td style="border-radius:8px;background:#0061ff"><a href="${esc(opts.link)}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${button}</a></td></tr></table>`
            : ""
        }
        ${opts.attachedPdf ? `<div style="margin-top:14px;font-size:12px;color:#59636e">The ${esc(word.toLowerCase())} is attached as a PDF.</div>` : ""}
        <div style="margin-top:14px;font-size:12px;color:#8b949e">${kind === "quote" ? "This is a quotation, not a tax invoice." : "This is a proforma invoice, not a tax invoice."}</div>
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
    `${word} ${number}`,
    `Total: ${amount}`,
    ...(until ? [`Valid until: ${until}`] : []),
    ...(upi ? [`UPI: ${upi}`] : []),
    ...(opts.link && !opts.message.includes(opts.link) ? [`${kind === "quote" ? "View and accept" : "View"}: ${opts.link}`] : []),
    ...(opts.attachedPdf ? [`The ${word.toLowerCase()} is attached as a PDF.`] : []),
  ]
  return { html, text: lines.join("\n") }
}

/** To the business: a client accepted or declined a quote on the public page. */
export function quoteResponseEmail(args: { business: string; number: string; kind: "quote" | "proforma"; action: "accepted" | "declined"; name: string | null; comment: string | null; amount: string; expired: boolean; link: string; autoConverted: boolean }) {
  const word = args.kind === "proforma" ? "Proforma" : "Quote"
  const who = args.name || "Your client"
  const head = `${who} ${args.action} ${word.toLowerCase()} ${args.number}`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(head)}</title></head>
<body style="margin:0;padding:24px 16px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e5ea;border-radius:12px"><tr><td style="padding:24px">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:${args.action === "accepted" ? "#12805c" : "#b42318"};font-weight:700">${args.action === "accepted" ? "Accepted" : "Declined"}</div>
  <div style="margin-top:6px;font-size:18px;font-weight:700;color:#1f2328">${esc(head)}</div>
  <div style="margin-top:4px;font-size:14px;color:#59636e">${esc(args.amount)}${args.expired ? " · accepted after it expired, so confirm the price still stands" : ""}</div>
  ${args.comment ? `<div style="margin-top:14px;padding:12px 14px;border-left:3px solid #e3e5ea;font-size:14px;color:#1f2328">${esc(args.comment)}</div>` : ""}
  ${args.autoConverted ? `<div style="margin-top:14px;font-size:13px;color:#59636e">A draft invoice was created from it.</div>` : ""}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td style="border-radius:8px;background:#0061ff"><a href="${esc(args.link)}" style="display:inline-block;padding:10px 18px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">Open in PrettyBills</a></td></tr></table>
</td></tr></table>
</body></html>`
  const text = [head, args.amount, ...(args.expired ? ["Accepted after it expired: confirm the price still stands."] : []), ...(args.comment ? [`"${args.comment}"`] : []), ...(args.autoConverted ? ["A draft invoice was created from it."] : []), args.link].join("\n")
  return { subject: `${head} – ${args.amount}`, html, text }
}
