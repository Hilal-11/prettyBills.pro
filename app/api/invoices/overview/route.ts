import { optionalUserId } from "@/lib/auth/user"
import { EMPTY_OVERVIEW } from "@/lib/data/types"
import { getOverview } from "@/lib/server/db/invoices"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/** Counts and totals for the sidebar. Guests, and a database that isn't set up yet, get zeros. */
export async function GET() {
  if (!(await optionalUserId())) return json({ overview: EMPTY_OVERVIEW, guest: true })
  try {
    return json({ overview: await getOverview(await createClient()) })
  } catch {
    return json({ overview: EMPTY_OVERVIEW })
  }
}
