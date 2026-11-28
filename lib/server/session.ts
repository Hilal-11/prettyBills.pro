import "server-only"

import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"

/**
 * The request's database client and the signed-in user's id, or null for
 * guests. Pages and Server Actions use this; RLS does the rest.
 */
export const getSession = cache(async function getSession(): Promise<{ db: SupabaseClient; userId: string } | null> {
  // once per request (React cache): the layout, the page and its sections share it.
  // getClaims verifies the JWT locally (asymmetric signing keys, cached), no network call.
  const db = await createClient()
  const { data } = await db.auth.getClaims()
  const userId = data?.claims?.sub
  return userId ? { db, userId } : null
})

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }
