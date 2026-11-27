import { requireUserId } from "@/lib/auth/user"
import { planSummary } from "@/lib/server/billing"
import { listNumbers } from "@/lib/server/db/invoices"
import { dbMessage, dbStatus } from "@/lib/server/db/util"
import { getSettings, listClients, listItems } from "@/lib/server/db/workspace"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/** Everything the editor needs to start: defaults, clients, items, used numbers and the plan. One round trip. */
export async function GET() {
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const db = await createClient()
  try {
    const [settings, clients, items, numbers, plan] = await Promise.all([getSettings(db), listClients(db), listItems(db), listNumbers(db), planSummary(db, auth.userId)])
    return json({ settings, clients, items: items.map((i) => ({ ...i, updatedAt: undefined })), numbers, plan })
  } catch (error) {
    return json({ error: dbMessage(error) }, dbStatus(error))
  }
}
