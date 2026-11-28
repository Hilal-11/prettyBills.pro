import { getCurrentUser } from "@/lib/auth/user"
import { BOM, csvAmount, csvRow } from "@/lib/billing/csv"
import { fyLabel, fyRange, todayIST } from "@/lib/billing/dates"
import { fyQuarter, QUARTERS, tdsLabel } from "@/lib/billing/tds"
import { listTdsPayments, noteExport } from "@/lib/server/db/payments"
import { json } from "@/lib/server/http"
import { rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

const HEADER = ["FY", "Quarter", "Payment date", "Client", "Client PAN", "Invoice no", "TDS section", "Received (INR)", "TDS (INR)", "Settled (INR)", "Certificate received", "Receipt no"]

/**
 * GET /api/payments/tds-export?fy=26-27
 * Every payment with TDS in that financial year, one row each with its
 * quarter, for matching against Form 26AS / AIS. Same Excel-safe CSV as
 * the payments export.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return json({ error: "Your session has ended. Log in again." }, 401)
  const limit = rateLimit(`export:${user.id}`, 20, 60_000)
  if (!limit.ok) return json({ error: `Too many exports. Try again in ${limit.retryAfter}s.` }, 429)

  const param = new URL(request.url).searchParams.get("fy") ?? ""
  const fy = /^\d{2}-\d{2}$/.test(param) ? param : fyLabel(todayIST())
  const { from, to } = fyRange(`20${fy.slice(0, 2)}-04-01`)
  const db = await createClient()

  let payments: Awaited<ReturnType<typeof listTdsPayments>>
  try {
    payments = await listTdsPayments(db, from, to)
  } catch (error) {
    console.error("[export] TDS export failed:", error instanceof Error ? error.message : error)
    return json({ error: "Couldn't export TDS right now. Try again." }, 500)
  }

  let body = BOM + csvRow(HEADER)
  for (const p of payments) {
    const q = QUARTERS[fyQuarter(p.paidOn) - 1]
    body += csvRow([fy, `${q.label} (${q.months})`, p.paidOn, p.clientName, p.clientPan, p.invoiceNumber, tdsLabel(p.tdsSection), csvAmount(p.amount), csvAmount(p.tdsPaise), csvAmount(p.amount + p.tdsPaise), p.tdsCertificate ? "Yes" : "No", p.receiptNumber])
  }
  await noteExport(db, "tds.exported", { fy, rows: payments.length })

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="prettybill-tds_FY${fy}.csv"`,
      "cache-control": "no-store",
    },
  })
}
