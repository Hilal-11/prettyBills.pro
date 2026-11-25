import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Only routes that care about the session. The landing page, public invoice
  // links, print pages and static files skip the round trip entirely.
  matcher: [
    "/dashboard",
    "/create",
    "/invoices/:path*",
    "/clients",
    "/items",
    "/templates",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/api/invoices/:path*",
    "/api/workspace/:path*",
    "/api/clients/:path*",
    "/api/items/:path*",
    "/api/feedback",
  ],
}
