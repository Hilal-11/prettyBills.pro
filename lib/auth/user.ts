import "server-only"

import { createClient } from "@/lib/supabase/server"

import type { SessionUser } from "./types"

export type { SessionUser }

const initialsOf = (name: string) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?"

/**
 * The signed-in user, or null. Verifies the access token (getClaims) rather
 * than trusting the cookie as-is, then reads the profile row for the display
 * name, falling back to sign-up metadata if the profiles table isn't set up.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>
  const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", claims.sub).maybeSingle()

  const email = String(claims.email ?? "")
  const name = String(profile?.full_name || meta.full_name || meta.name || email.split("@")[0] || "You")
  const avatar = profile?.avatar_url || meta.avatar_url || meta.picture
  return { id: claims.sub, email, name, initials: initialsOf(name), avatarUrl: typeof avatar === "string" ? avatar : null, plan: "Free" }
}

/** For Route Handlers open to guests: the caller's user id, or null when signed out. */
export async function optionalUserId() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims?.sub ?? null
}

/** For Route Handlers: the caller's user id, or a ready 401 response. */
export async function requireUserId(): Promise<{ userId: string; response?: never } | { userId?: never; response: Response }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return { response: Response.json({ error: "Your session has ended. Log in again." }, { status: 401 }) }
  return { userId }
}
