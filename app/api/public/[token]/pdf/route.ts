import { pdfFilename } from "@/lib/invoice/format"
import { sharedInvoice, trackShared } from "@/lib/server/db/invoices"
import { renderInvoicePdf } from "@/lib/server/pdf"
import { json, originOf } from "@/lib/server/http"
import { clientIp, rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

/** PDF of a shared invoice. Anyone with the link; limited per IP since rendering runs a browser. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const limit = rateLimit(`public-pdf:${clientIp(request)}`, 12, 60_000)
  if (!limit.ok) return Response.json({ error: `Too many downloads. Try again in ${limit.retryAfter}s.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } })
  const db = await createClient()
  const invoice = await sharedInvoice(db, token)
  if (!invoice) return json({ error: "Not found" }, 404)
  try {
    const pdf = await renderInvoicePdf(invoice, originOf(request))
    await trackShared(db, token, "downloaded")
    return new Response(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdfFilename(invoice.number, invoice.billTo.name)}"`,
        "cache-control": "no-store",
      },
    })
  } catch {
    return json({ error: "PDF rendering failed" }, 500)
  }
}
