import { requireUserId } from "@/lib/auth/user"
import type { Client } from "@/lib/invoice/defaults"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { saveClient } from "@/lib/server/db/workspace"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/** Creates or updates a client. Body: { client }. */
export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const client = ((await request.json().catch(() => null)) as { client?: Client } | null)?.client
  if (!client || typeof client.id !== "string" || !/^[\w-]{1,64}$/.test(client.id) || typeof client.name !== "string") return json({ error: "Invalid client" }, 400)
  try {
    await saveClient(await createClient(), auth.userId, client)
    return json({ ok: true })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
