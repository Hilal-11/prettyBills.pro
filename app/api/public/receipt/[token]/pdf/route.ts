import { pdfFilename } from "@/lib/invoice/format"
import { sharedReceipt } from "@/lib/server/db/payments"
import { json, originOf } from "@/lib/server/http"
import { renderReceiptPdf } from "@/lib/server/pdf"
import { clientIp, rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

/** PDF of a shared receipt. Anyone with the link while it's active; limited per IP. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const limit = rateLimit(`public-pdf:${clientIp(request)}`, 12, 60_000)
  if (!limit.ok) return Response.json({ error: `Too many downloads. Try again in ${limit.retryAfter}s.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } })
  const view = await sharedReceipt(await createClient(), token)
  if (!view) return json({ error: "Not found" }, 404)
  try {
    const pdf = await renderReceiptPdf(view, originOf(request))
    return new Response(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdfFilename(view.receipt.number, view.invoice.billTo.name)}"`,
        "cache-control": "no-store",
      },
    })
  } catch {
    return json({ error: "PDF rendering failed" }, 500)
  }
}
