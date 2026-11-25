import { requireUserId } from "@/lib/auth/user"
import type { CatalogItem } from "@/lib/invoice/defaults"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { saveItem } from "@/lib/server/db/workspace"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/** Creates or updates a catalog item. Body: { item }. */
export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const item = ((await request.json().catch(() => null)) as { item?: CatalogItem } | null)?.item
  if (!item || typeof item.id !== "string" || !/^[\w-]{1,64}$/.test(item.id) || typeof item.name !== "string") return json({ error: "Invalid item" }, 400)
  try {
    await saveItem(await createClient(), auth.userId, item)
    return json({ ok: true })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
