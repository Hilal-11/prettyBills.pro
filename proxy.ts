import { NextResponse, type NextRequest } from "next/server"

import { gatedFeature } from "@/config/features"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  // a feature that isn't live yet (config/features.ts): the shared Coming soon
  // page, with the address bar unchanged
  const gated = gatedFeature(request.nextUrl.pathname)
  if (gated) return NextResponse.rewrite(new URL(`/coming-soon/${gated.id}`, request.url))
  return updateSession(request)
}

export const config = {
  // Only routes that care about the session. The landing page, public invoice
  // links, print pages and static files skip the round trip entirely.
  matcher: [
    "/dashboard",
    "/create",
    "/invoices/:path*",
    "/clients/:path*",
    "/payments",
    "/receipts/:path*",
    "/templates",
    "/pricing",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/api/invoices/:path*",
    "/api/workspace/:path*",
    "/api/clients/:path*",
    "/api/items/:path*",
    "/api/feedback",
    "/api/billing/:path*",
    "/api/payments/:path*",
    "/api/receipts/:path*",
    "/api/quotes/:path*",
    "/api/credit-notes/:path*",
    // every feature in config/features.ts that has its own route: not-yet-live ones
    // get the Coming soon page; once live, these just refresh the session
    "/quotes/:path*",
    "/credit-notes/:path*",
    "/recurring/:path*",
    "/reminders/:path*",
    "/payment-links/:path*",
    "/expenses/:path*",
    "/reports/:path*",
    "/import/:path*",
    "/team/:path*",
    "/notifications/:path*",
    "/languages/:path*",
    "/e-invoicing/:path*",
    "/e-way-bill/:path*",
    "/inventory/:path*",
    "/api-keys/:path*",
  ],
}
