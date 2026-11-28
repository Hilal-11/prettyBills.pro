import { bucketOf } from "@/lib/server/db/invoices"
import { today } from "@/lib/server/db/util"
import { json } from "@/lib/server/http"
import { rateLimit } from "@/lib/server/rate-limit"
import { getSession } from "@/lib/server/session"
import { stateLabel } from "@/lib/invoice/config"

export type SearchHit =
  | { kind: "invoice"; id: string; title: string; sub: string; status: string; amount: number; href: string }
  | { kind: "client"; id: string; title: string; sub: string; href: string }
  | { kind: "receipt"; id: string; title: string; sub: string; amount: number; href: string }

/** Escapes a term for a PostgREST ilike inside or(): no wildcards, no filter syntax. */
const term = (q: string) => q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ")

/**
 * GET /api/search?q=…&scope=all|invoices|clients
 * The ⌘K palette: the signed-in user's invoices, clients and receipts that
 * match (number, client name, GSTIN, email, phone). With no query, the most
 * recently touched ones. Row level security keeps it to the caller's rows.
 */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return json({ error: "Log in to search your invoices and clients." }, 401)
  const limit = rateLimit(`search:${session.userId}`, 120, 60_000)
  if (!limit.ok) return json({ error: "Searching too fast. Try again in a moment." }, 429)

  const url = new URL(request.url)
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80)
  const scope = url.searchParams.get("scope") ?? "all"
  const many = scope !== "all"
  const t = term(q)
  const { db } = session
  const on = today()

  const invoices =
    scope === "all" || scope === "invoices"
      ? (() => {
          let r = db.from("invoices").select("id, number, client_name, status, total, balance_due, due_date, issue_date").order("updated_at", { ascending: false }).limit(many ? 25 : 6)
          if (q) r = r.or(`number.ilike.%${t}%,client_name.ilike.%${t}%`)
          return r
        })()
      : null
  const clients =
    scope === "all" || scope === "clients"
      ? (() => {
          let r = db.from("clients").select("id, name, gstin, email, phone, address").order(q ? "name" : "updated_at", { ascending: !!q }).limit(many ? 25 : 5)
          if (q) r = r.or(`name.ilike.%${t}%,gstin.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%,legal_name.ilike.%${t}%`)
          return r
        })()
      : null
  const receipts = q && (scope === "all" || scope === "receipts") ? db.from("receipt_rows").select("id, number, client_name, invoice_number, amount_paise").ilike("number", `%${t}%`).limit(4) : null

  const [inv, cl, rc] = await Promise.all([invoices, clients, receipts])
  if (inv?.error || cl?.error) return json({ error: "Search isn't available right now." }, 500)

  const hits: SearchHit[] = []
  for (const r of (inv?.data ?? []) as { id: string; number: string; client_name: string | null; status: string; total: number; balance_due: number; due_date: string | null; issue_date: string }[]) {
    const bucket = bucketOf(r.status, r.due_date, Number(r.balance_due), on)
    hits.push({ kind: "invoice", id: r.id, title: r.number || "Untitled draft", sub: r.client_name || "No client yet", status: bucket, amount: Number(bucket === "sent" || bucket === "overdue" ? r.balance_due : r.total), href: `/invoices/${r.id}` })
  }
  for (const r of (cl?.data ?? []) as { id: string; name: string; gstin: string | null; email: string | null; phone: string | null; address: { city?: string; stateCode?: string } | null }[]) {
    const place = [r.address?.city, r.address?.stateCode && stateLabel(r.address.stateCode).replace(/ \(\d+\)$/, "")].filter(Boolean).join(", ")
    hits.push({ kind: "client", id: r.id, title: r.name, sub: [r.gstin, place || r.email || r.phone].filter(Boolean).join(" · ") || "Client", href: `/clients/${encodeURIComponent(r.id)}` })
  }
  if (rc && !rc.error)
    for (const r of rc.data as { id: string; number: string; client_name: string | null; invoice_number: string; amount_paise: number }[])
      hits.push({ kind: "receipt", id: r.id, title: r.number, sub: [r.client_name, `for ${r.invoice_number}`].filter(Boolean).join(" · "), amount: Number(r.amount_paise), href: `/receipts/${r.id}` })

  return json({ hits }, 200)
}
