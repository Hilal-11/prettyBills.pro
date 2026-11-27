import { requireUserId } from "@/lib/auth/user"
import { pdfFilename } from "@/lib/invoice/format"
import { getReceiptView } from "@/lib/server/db/payments"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { json, originOf } from "@/lib/server/http"
import { renderReceiptPdf } from "@/lib/server/pdf"
import { rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

/** The owner's download of a receipt, void ones included (they carry the VOID mark). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const limit = rateLimit(`pdf:${auth.userId}`, 60, 60_000)
  if (!limit.ok) return json({ error: `Too many downloads. Try again in ${limit.retryAfter}s.` }, 429)
  try {
    const view = await getReceiptView(await createClient(), id)
    if (!view) return json({ error: "Not found" }, 404)
    const pdf = await renderReceiptPdf(view, originOf(request))
    return new Response(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdfFilename(view.receipt.number, view.invoice.billTo.name)}"`,
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof Error && !("status" in error)) return json({ error: error.message }, 500)
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
