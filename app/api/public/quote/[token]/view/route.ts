import { trackSharedQuote } from "@/lib/server/db/quotes"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/** Beacon from /q/<token>. The first open of a sent quote marks it Viewed. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const first = await trackSharedQuote(await createClient(), token)
  if (first === null) return json({ error: "Not found" }, 404)
  return json({ ok: true, first })
}
