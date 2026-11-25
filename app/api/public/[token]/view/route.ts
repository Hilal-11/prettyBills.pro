import { trackShared } from "@/lib/server/db/invoices"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/** Beacon from the public page. The first view moves a sent invoice to "viewed". */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const first = await trackShared(await createClient(), token, "viewed")
  if (first === null) return json({ error: "Not found" }, 404)
  return json({ ok: true, first })
}
