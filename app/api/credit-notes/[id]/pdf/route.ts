import { requireUserId } from "@/lib/auth/user"
import { pdfFilename } from "@/lib/invoice/format"
import { getCreditNote } from "@/lib/server/db/credit-notes"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { json, originOf } from "@/lib/server/http"
import { renderCreditNotePdf } from "@/lib/server/pdf"
import { rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

/** The owner's download of a credit note (drafts carry DRAFT, void ones VOID). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const limit = rateLimit(`pdf:${auth.userId}`, 60, 60_000)
  if (!limit.ok) return json({ error: `Too many downloads. Try again in ${limit.retryAfter}s.` }, 429)
  try {
    const note = await getCreditNote(await createClient(), id)
    if (!note) return json({ error: "Not found" }, 404)
    const pdf = await renderCreditNotePdf(note, originOf(request))
    return new Response(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdfFilename(note.number ?? "CN-draft", note.clientName)}"`,
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof Error && !("status" in error)) return json({ error: error.message }, 500)
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
