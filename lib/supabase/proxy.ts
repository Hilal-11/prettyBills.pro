import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { GUEST_ONLY, PROTECTED, matches, safeNext } from "@/lib/auth/redirect"

import { supabaseEnv } from "./env"

/**
 * Refreshes the Supabase session cookie, then routes:
 * - signed out on a protected page → /login?next=<page>
 * - signed in on /login, /signup, /forgot-password → the app
 * API routes are never redirected; they answer 401 themselves.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { url, key } = supabaseEnv()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v)
      },
    },
  })

  // Nothing may run between createServerClient and getClaims: this call is
  // what refreshes an expired access token.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  const redirectTo = (target: string) => {
    const res = NextResponse.redirect(new URL(target, request.url))
    // carry refreshed auth cookies over to the redirect
    for (const c of response.cookies.getAll()) res.cookies.set(c)
    return res
  }

  if (!signedIn && matches(pathname, PROTECTED)) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`)
  }
  if (signedIn && matches(pathname, GUEST_ONLY)) {
    return redirectTo(safeNext(request.nextUrl.searchParams.get("next")))
  }
  return response
}
