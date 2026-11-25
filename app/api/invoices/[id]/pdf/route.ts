import { optionalUserId, requireUserId } from "@/lib/auth/user"
import { pdfFilename } from "@/lib/invoice/format"
import type { Invoice } from "@/lib/invoice/types"
import { getInvoice } from "@/lib/server/db/invoices"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { renderInvoicePdf } from "@/lib/server/pdf"
import { json, originOf, parseInvoice } from "@/lib/server/http"
import { clientIp, rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

/**
 * POST { invoice, colorless? }: renders what the editor shows. Stores nothing,
 * so guests can use it too (rate limited, since rendering runs a browser).
 * GET ?colorless=1: renders a saved invoice, for download buttons in lists.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await optionalUserId()
  const limit = rateLimit(`pdf:${userId ?? clientIp(request)}`, userId ? 60 : 12, 60_000)
  if (!limit.ok) return tooMany(limit.retryAfter, !userId)
  const body = (await request.json().catch(() => null)) as { colorless?: boolean } | null
  const invoice = parseInvoice(body)
  if (!invoice || invoice.id !== id) return json({ error: "Invalid invoice" }, 400)
  return render(invoice, request, !!body?.colorless)
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const limit = rateLimit(`pdf:${auth.userId}`, 60, 60_000)
  if (!limit.ok) return tooMany(limit.retryAfter, false)
  try {
    const invoice = await getInvoice(await createClient(), id)
    if (!invoice) return json({ error: "Not found" }, 404)
    return render(invoice, request, new URL(request.url).searchParams.get("colorless") === "1")
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}

async function render(invoice: Invoice, request: Request, colorless: boolean) {
  const printable = colorless ? { ...invoice, pageColor: "white" as const } : invoice
  try {
    const pdf = await renderInvoicePdf(printable, originOf(request))
    return new Response(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdfFilename(invoice.number, invoice.billTo.name)}"`,
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "PDF rendering failed" }, 500)
  }
}

function tooMany(retryAfter: number, guest: boolean) {
  return Response.json(
    { error: `Too many downloads. Try again in ${retryAfter}s${guest ? ", or log in" : ""}.` },
    { status: 429, headers: { "retry-after": String(retryAfter) } }
  )
}
