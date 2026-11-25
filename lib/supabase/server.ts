import "server-only"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { supabaseEnv } from "./env"

/**
 * Server Supabase client for Server Components, Route Handlers and Server
 * Actions. Create one per request; never share it between requests.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = supabaseEnv()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session on every protected request instead.
        }
      },
    },
  })
}
