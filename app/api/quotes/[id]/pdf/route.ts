import { pdfFilename } from "@/lib/invoice/format"
import { getQuoteDocument } from "@/lib/server/db/quotes"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { json, originOf } from "@/lib/server/http"
import { renderInvoicePdf } from "@/lib/server/pdf"
import { rateLimit } from "@/lib/server/rate-limit"
import { getSession } from "@/lib/server/session"

/** PDF of a saved quote or proforma (lists, detail page). QT-26-27-001_client.pdf. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return json({ error: "Your session has ended. Log in again." }, 401)
  const limit = rateLimit(`pdf:${session.userId}`, 60, 60_000)
  if (!limit.ok) return Response.json({ error: `Too many downloads. Try again in ${limit.retryAfter}s.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } })
  try {
    const found = await getQuoteDocument(session.db, id)
    if (!found) return json({ error: "Not found" }, 404)
    const doc = new URL(request.url).searchParams.get("colorless") === "1" ? { ...found.document, pageColor: "white" as const } : found.document
    const pdf = await renderInvoicePdf(doc, originOf(request))
    return new Response(Buffer.from(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${pdfFilename(doc.number, doc.billTo.name)}"`, "cache-control": "no-store" },
    })
  } catch (error) {
    return json({ error: error instanceof Error && !("status" in error) ? error.message : dbMessage(error) }, dbStatus(error))
  }
}
