import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

import { safeNext } from "@/lib/auth/redirect"
import { createClient } from "@/lib/supabase/server"

/**
 * Landing point for every emailed or OAuth link:
 * - ?code=…               Google sign-in, and email links opened in the same browser (PKCE)
 * - ?token_hash=…&type=…  email templates that use {{ .TokenHash }} (works in any browser)
 * Then redirects to ?next (same-site only), or back to /login with a reason.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get("next"))
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const providerError = searchParams.get("error_description") ?? searchParams.get("error")

  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${reason}`)
  if (providerError) return fail(/access_denied|cancel/i.test(providerError) ? "cancelled" : "provider")

  const supabase = await createClient()
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return error ? fail("link") : NextResponse.redirect(`${origin}${next}`)
  }
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    return error ? fail("link") : NextResponse.redirect(`${origin}${type === "recovery" ? "/reset-password" : next}`)
  }
  return fail("link")
}
