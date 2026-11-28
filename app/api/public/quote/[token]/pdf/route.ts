import { pdfFilename } from "@/lib/invoice/format"
import { sharedQuote } from "@/lib/server/db/quotes"
import { json, originOf } from "@/lib/server/http"
import { renderInvoicePdf } from "@/lib/server/pdf"
import { clientIp, rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

/** PDF of a shared quote (the revision the client sees). Limited per IP: rendering runs a browser. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const limit = rateLimit(`public-pdf:${clientIp(request)}`, 12, 60_000)
  if (!limit.ok) return Response.json({ error: `Too many downloads. Try again in ${limit.retryAfter}s.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } })
  const shared = await sharedQuote(await createClient(), token)
  if (!shared) return json({ error: "Not found" }, 404)
  try {
    const pdf = await renderInvoicePdf(shared.document, originOf(request))
    return new Response(Buffer.from(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${pdfFilename(shared.number, shared.document.billTo.name)}"`, "cache-control": "no-store" },
    })
  } catch {
    return json({ error: "PDF rendering failed" }, 500)
  }
}
