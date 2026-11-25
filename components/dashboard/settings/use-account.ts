"use client"

import * as React from "react"
import type { User } from "@supabase/supabase-js"

import { EMPTY_SETTINGS, type WorkspaceSettings } from "@/lib/data/types"
import { fetchSettings } from "@/lib/client/workspace"
import { createClient } from "@/lib/supabase/client"

export type Profile = { full_name: string | null; avatar_url: string | null; marketing_opt_in: boolean }

export type Account =
  | { status: "loading" }
  | { status: "guest" }
  | {
      status: "user"
      user: User
      /** null when the profiles table isn't set up yet; fields then come from sign-up metadata. */
      profile: Profile | null
    }

/**
 * The signed-in user (verified with the auth server) and their profile row,
 * loaded when settings open. `reload()` after an edit.
 */
export function useAccount() {
  const [account, setAccount] = React.useState<Account>({ status: "loading" })
  const [version, setVersion] = React.useState(0)

  React.useEffect(() => {
    let live = true
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!live) return
      if (!data.user) return setAccount({ status: "guest" })
      const { data: profile, error } = await supabase.from("profiles").select("full_name, avatar_url, marketing_opt_in").eq("id", data.user.id).maybeSingle()
      if (live) setAccount({ status: "user", user: data.user, profile: error ? null : (profile as Profile | null) })
    })()
    return () => {
      live = false
    }
  }, [version])

  const reload = React.useCallback(() => setVersion((v) => v + 1), [])
  return { account, reload }
}

export function displayName(user: User, profile: Profile | null) {
  const meta = user.user_metadata ?? {}
  return String(profile?.full_name || meta.full_name || meta.name || user.email?.split("@")[0] || "")
}

export function avatarOf(user: User, profile: Profile | null): string | null {
  const meta = user.user_metadata ?? {}
  const url = profile?.avatar_url || meta.avatar_url || meta.picture
  return typeof url === "string" ? url : null
}

export function initialsOf(name: string) {
  return (
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  )
}

/** The signed-in user's invoice defaults, loaded when a settings tab needs them. */
export function useSettings(enabled: boolean) {
  const [state, setState] = React.useState<{ status: "loading" | "ready" | "error"; settings: WorkspaceSettings }>({ status: "loading", settings: EMPTY_SETTINGS })
  React.useEffect(() => {
    if (!enabled) return
    let live = true
    fetchSettings().then((settings) => live && setState(settings ? { status: "ready", settings } : { status: "error", settings: EMPTY_SETTINGS }))
    return () => {
      live = false
    }
  }, [enabled])
  const patch = React.useCallback((p: Partial<WorkspaceSettings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } })), [])
  return { ...state, patch }
}
