import { requireUserId } from "@/lib/auth/user"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { deleteItem } from "@/lib/server/db/workspace"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUserId()
  if (auth.response) return auth.response
  try {
    await deleteItem(await createClient(), id)
    return json({ ok: true })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
