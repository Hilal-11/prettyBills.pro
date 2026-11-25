import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import { supabaseEnv } from "./env"

let client: SupabaseClient | undefined

/** Browser Supabase client. The session lives in cookies so the server can read it too. */
export function createClient() {
  if (client) return client
  const { url, key } = supabaseEnv()
  client = createBrowserClient(url, key)
  return client
}
