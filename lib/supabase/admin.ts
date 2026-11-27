import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { supabaseEnv } from "./env"

let admin: SupabaseClient | null = null

/**
 * Service-role client: bypasses row level security. Only for the few writes
 * no user may make themselves (recording a paid subscription from Razorpay).
 * Never import it into anything a browser can reach.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.")
  admin ??= createClient(supabaseEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return admin
}
