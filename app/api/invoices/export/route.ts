import { getCurrentUser } from "@/lib/auth/user"
import { BOM, csvAmount, csvRow } from "@/lib/billing/csv"
import { parseInvoiceQuery } from "@/lib/billing/invoice-query"
import { MODE_LABEL } from "@/lib/billing/modes"
import { paymentMethods, queryInvoices } from "@/lib/server/db/invoices"
import { noteExport } from "@/lib/server/db/payments"
import { today } from "@/lib/server/db/util"
import { json } from "@/lib/server/http"
import { rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

const HEADER = ["Invoice no", "Client", "Status", "Issue date", "Due date", "Days late", "Total (INR)", "Paid (INR)", "Balance (INR)", "Paid on", "Method", "Sent on", "Opened on"]

const STATUS: Record<string, string> = { draft: "Draft", sent: "Sent", viewed: "Viewed", partially_paid: "Part paid", paid: "Paid", void: "Void" }
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "")

/**
 * GET /api/invoices/export?<the invoices table's URL state>[&ids=a,b]
 * What the table shows (every page of it, in the same order) as CSV, or just
 * the selected rows with `ids`. Batches of 1,000; same Excel-safe CSV as the
 * payments export.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return json({ error: "Your session has ended. Log in again." }, 401)
  const limit = rateLimit(`export:${user.id}`, 20, 60_000)
  if (!limit.ok) return json({ error: `Too many exports. Try again in ${limit.retryAfter}s.` }, 429)

  const params = new URL(request.url).searchParams
  const q = parseInvoiceQuery(params)
  const ids = (params.get("ids") ?? "")
    .split(",")
    .filter((id) => /^[\w-]{1,96}$/.test(id))
    .slice(0, 500)
  const db = await createClient()
  const encoder = new TextEncoder()
  const on = today()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(BOM + csvRow(HEADER)))
      try {
        for (let offset = 0; ; offset += 1000) {
          const page = await queryInvoices(db, ids.length ? { ...q, view: "all" } : q, { limit: 1000, offset, ids: ids.length ? ids : undefined })
          const methods = await paymentMethods(
            db,
            page.invoices.filter((i) => i.amountPaid > 0).map((i) => i.id)
          )
          let chunk = ""
          for (const i of page.invoices) {
            const m = methods[i.id]
            chunk += csvRow([
              i.number,
              i.clientName,
              i.bucket === "overdue" ? "Overdue" : (STATUS[i.status] ?? i.status),
              i.issueDate,
              day(i.dueDate),
              i.bucket === "overdue" ? (i.daysPastDue ?? "") : "",
              csvAmount(i.total),
              csvAmount(i.amountPaid),
              csvAmount(i.balanceDue),
              day(i.paidAt),
              m ? MODE_LABEL[m.mode] + (m.modes > 1 ? ` +${m.modes - 1}` : "") : "",
              day(i.sentAt),
              day(i.viewedAt),
            ])
          }
          controller.enqueue(encoder.encode(chunk))
          if (offset + 1000 >= page.total || !page.invoices.length) break
        }
        await noteExport(db, "invoices.exported", { view: q.view, selected: ids.length })
        controller.close()
      } catch (error) {
        console.error("[export] invoices export failed:", error instanceof Error ? error.message : error)
        controller.error(error)
      }
    },
  })

  const name = `prettybill-invoices_${ids.length ? "selected" : q.view}_${on}.csv`
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  })
}
