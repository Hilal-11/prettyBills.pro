import { getCurrentUser } from "@/lib/auth/user"
import { BOM, csvAmount, csvRow } from "@/lib/billing/csv"
import { todayIST } from "@/lib/billing/dates"
import { parseFilters } from "@/lib/billing/filters"
import { MODE_LABEL } from "@/lib/billing/modes"
import { listPayments, noteExport } from "@/lib/server/db/payments"
import { json } from "@/lib/server/http"
import { rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

const HEADER = ["Payment date", "Client", "Client GSTIN", "Invoice no", "Invoice date", "Mode", "Reference", "Amount (INR)", "Receipt no", "Note", "Recorded by", "Recorded at"]

const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const recordedAt = (iso: string) => stamp.format(new Date(iso)).replace(",", "")

/**
 * GET /api/payments/export?<the Payments page filters>
 * Every matching payment as CSV, streamed in batches of 1,000 so there's no
 * row limit. UTF-8 with a BOM so Excel shows ₹ and non-Latin names; cells that
 * could run as formulas are neutralised (lib/billing/csv).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return json({ error: "Your session has ended. Log in again." }, 401)
  const limit = rateLimit(`export:${user.id}`, 20, 60_000)
  if (!limit.ok) return json({ error: `Too many exports. Try again in ${limit.retryAfter}s.` }, 429)

  const filters = parseFilters(new URL(request.url).searchParams, todayIST())
  const db = await createClient()
  const encoder = new TextEncoder()
  let rows = 0

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(BOM + csvRow(HEADER)))
      let cursor: string | undefined
      try {
        do {
          const page = await listPayments(db, filters, { cursor, limit: 1000 })
          let chunk = ""
          for (const p of page.payments) {
            chunk += csvRow([p.paidOn, p.clientName, p.clientGstin, p.invoiceNumber, p.invoiceDate, MODE_LABEL[p.mode], p.reference, csvAmount(p.amount), p.receiptNumber, p.note, p.createdBy === user.id ? user.name : "", recordedAt(p.createdAt)])
          }
          rows += page.payments.length
          controller.enqueue(encoder.encode(chunk))
          cursor = page.next ?? undefined
        } while (cursor)
        await noteExport(db, "payments.exported", { filters: { from: filters.from, to: filters.to, clients: filters.clients, modes: filters.modes, q: filters.q }, rows })
        controller.close()
      } catch (error) {
        console.error("[export] payments export failed:", error instanceof Error ? error.message : error)
        controller.error(error)
      }
    },
  })

  const name = `prettybill-payments_${filters.from ?? "start"}_to_${filters.to ?? todayIST()}.csv`
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  })
}
