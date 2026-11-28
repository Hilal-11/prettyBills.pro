import type { StatementData } from "@/components/clients/statement-document"
import { requireUserId } from "@/lib/auth/user"
import { STATEMENT_KIND } from "@/lib/billing/ledger"
import { BOM, csvAmount, csvRow } from "@/lib/billing/csv"
import { todayIST } from "@/lib/billing/dates"
import { statementPeriod } from "@/lib/billing/filters"
import { clientStatement, getClient } from "@/lib/server/db/clients"
import { noteExport } from "@/lib/server/db/payments"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { getSettings } from "@/lib/server/db/workspace"
import { json, originOf } from "@/lib/server/http"
import { renderStatementPdf } from "@/lib/server/pdf"
import { rateLimit } from "@/lib/server/rate-limit"
import { createClient } from "@/lib/supabase/server"

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 40) || "client"

/** GET ?period=…&from=…&to=…&format=csv|pdf: a client's statement of account. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const limit = rateLimit(`statement:${auth.userId}`, 30, 60_000)
  if (!limit.ok) return json({ error: `Too many downloads. Try again in ${limit.retryAfter}s.` }, 429)

  const url = new URL(request.url)
  const today = todayIST()
  const { from, to } = statementPeriod(url.searchParams, today)
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv"
  const db = await createClient()
  try {
    const client = await getClient(db, id)
    if (!client) return json({ error: "Not found" }, 404)
    const statement = await clientStatement(db, id, from, to)
    const base = `statement_${slug(client.name)}_${from}_to_${to}`
    await noteExport(db, "statement.exported", { client_id: id, from, to, format })

    if (format === "pdf") {
      const settings = await getSettings(db)
      const data: StatementData = { business: settings.business, client, statement, generatedOn: today }
      const pdf = await renderStatementPdf(data, originOf(request))
      return new Response(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${base}.pdf"`, "cache-control": "no-store" } })
    }

    let body = BOM + csvRow(["Date", "Type", "Number", "Description", "Debit (INR)", "Credit (INR)", "Balance (INR)"])
    body += csvRow([from, "Opening balance", "", "", "", "", csvAmount(statement.opening)])
    for (const r of statement.rows) body += csvRow([r.date, STATEMENT_KIND[r.kind], r.number, r.description, r.debit ? csvAmount(r.debit) : "", r.credit ? csvAmount(r.credit) : "", csvAmount(r.balance)])
    body += csvRow([to, "Closing balance", "", "", csvAmount(statement.invoiced), csvAmount(statement.received + statement.tds), csvAmount(statement.closing)])
    return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}.csv"`, "cache-control": "no-store" } })
  } catch (error) {
    if (error instanceof Error && !("status" in error)) return json({ error: error.message }, 500)
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
