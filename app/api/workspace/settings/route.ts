import { requireUserId } from "@/lib/auth/user"
import type { WorkspaceSettings } from "@/lib/data/types"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { getSettings, saveSettings } from "@/lib/server/db/workspace"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireUserId()
  if (auth.response) return auth.response
  try {
    return json({ settings: await getSettings(await createClient()) })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}

/** Body: any of { business, payment, terms, signature }. null clears one. */
export async function PUT(request: Request) {
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const body = (await request.json().catch(() => null)) as Partial<WorkspaceSettings> | null
  if (!body || typeof body !== "object") return json({ error: "Invalid request" }, 400)
  if ("terms" in body && body.terms != null && (typeof body.terms !== "string" || body.terms.length > 4000)) return json({ error: "Terms are too long" }, 422)
  for (const k of ["business", "payment", "signature"] as const) {
    if (k in body && body[k] != null && typeof body[k] !== "object") return json({ error: `Invalid ${k}` }, 422)
  }
  try {
    await saveSettings(await createClient(), auth.userId, body)
    return json({ ok: true })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
