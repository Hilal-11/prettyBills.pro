import { requireUserId } from "@/lib/auth/user"
import type { InvoiceBucket } from "@/lib/data/types"
import { listInvoices } from "@/lib/server/db/invoices"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

const BUCKETS = new Set(["all", "draft", "sent", "overdue", "paid", "void"])

/** A page of the user's invoices. ?bucket=draft|sent|overdue|paid|void&q=&client=&offset=&limit= */
export async function GET(request: Request) {
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const p = new URL(request.url).searchParams
  const bucket = p.get("bucket") ?? "all"
  if (!BUCKETS.has(bucket)) return json({ error: "Unknown bucket" }, 400)
  try {
    const page = await listInvoices(await createClient(), {
      bucket: bucket as InvoiceBucket | "all",
      q: p.get("q") ?? undefined,
      clientId: p.get("client") ?? undefined,
      offset: Math.max(0, Number(p.get("offset")) || 0),
      limit: Math.min(100, Math.max(1, Number(p.get("limit")) || 50)),
    })
    return json(page)
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
