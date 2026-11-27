import { buildStatement } from "@/lib/billing/ledger"
import type { ReceiptView } from "@/lib/data/types"
import { sampleInvoiceModel } from "@/lib/invoice/sample"
import { computeInvoiceTotals } from "@/lib/invoice/totals"
import { invoiceEmail } from "@/lib/server/invoice-email"
import { receiptEmail } from "@/lib/server/receipt-email"
import { putJob, putReceiptJob } from "@/lib/server/store"

/**
 * Development only, with the sample invoice:
 *   (no params)            the invoice email as clients see it (?text=1 for plain text)
 *   ?kind=receipt-email    the payment receipt email
 *   ?kind=receipt          the receipt document (&part=1 part payment, &void=1, &black=1)
 *   ?kind=statement        a statement of account
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 })
  const url = new URL(request.url)
  const q = url.searchParams
  const kind = q.get("kind")
  const invoice = { ...sampleInvoiceModel(), status: "sent" as const }

  if (kind === "receipt" || kind === "receipt-email") {
    const total = computeInvoiceTotals(invoice).total
    const part = q.get("part") === "1"
    const amount = part ? Math.round(total * 0.4) : total
    const view: ReceiptView = {
      receipt: { id: "00000000-0000-4000-8000-000000000000", number: "RCPT/26-27/004", date: "2026-11-25", revision: q.get("revised") === "1" ? 2 : 1, status: q.get("void") === "1" ? "void" : "active", voidReason: q.get("void") === "1" ? "Entered twice" : null, templateId: invoice.templateId, pageColor: q.get("black") === "1" ? "black" : "white", publicToken: "preview" },
      payment: { id: "p", amount, paidOn: "2026-11-25", mode: "upi", reference: "512345678901" },
      invoice: { ...invoice, templateId: q.get("template") ?? invoice.templateId, pageColor: q.get("black") === "1" ? "black" : "white" },
      balance: { total, paidBefore: 0, thisPayment: amount, remaining: total - amount, paidInFull: !part },
    }
    view.receipt.templateId = view.invoice.templateId
    if (kind === "receipt-email") {
      const { html, text } = receiptEmail(view, { link: `${url.origin}/r/preview`, attachedPdf: true })
      return q.get("text") ? new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } }) : new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
    }
    return Response.redirect(`${url.origin}/print/receipt/${await putReceiptJob(view)}`, 302)
  }

  if (kind === "statement") {
    const total = computeInvoiceTotals(invoice).total
    const statement = buildStatement({
      from: "2026-04-01",
      to: "2026-11-25",
      invoices: [
        { id: "a", number: "INV/26-27/009", issueDate: "2026-03-20", total: 1200000, createdAt: "2026-03-20T00:00:00Z" },
        { id: "b", number: invoice.number, issueDate: "2026-11-01", dueDate: "2026-11-16", total, createdAt: "2026-11-01T00:00:00Z" },
      ],
      payments: [
        { id: "p0", invoiceId: "a", invoiceNumber: "INV/26-27/009", paidOn: "2026-04-10", amount: 1200000, mode: "Bank transfer", reference: "HDFCN52026041012345", receiptNumber: "RCPT/26-27/001", createdAt: "2026-04-10T00:00:00Z" },
        { id: "p1", invoiceId: "b", invoiceNumber: invoice.number, paidOn: "2026-11-20", amount: Math.round(total * 0.4), mode: "UPI", reference: "512345678901", receiptNumber: "RCPT/26-27/004", createdAt: "2026-11-20T00:00:00Z" },
      ],
    })
    const client = { id: "c", name: invoice.billTo.name, gstin: invoice.billTo.gstin, email: invoice.billTo.email, phone: invoice.billTo.phone, address: invoice.billTo.address }
    return Response.redirect(`${url.origin}/print/statement/${await putJob("statement", { business: invoice.from, client, statement, generatedOn: "2026-11-25" })}`, 302)
  }

  const link = `${url.origin}/i/sample-token-preview`
  const { html, text } = invoiceEmail(invoice, {
    message: `Hi ${invoice.billTo.name},\n\nPlease find invoice ${invoice.number} attached. You can also view and pay it online: ${link}\n\nThanks,\n${invoice.from.name}`,
    link,
    attachedPdf: true,
  })
  return q.get("text") ? new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } }) : new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
}
