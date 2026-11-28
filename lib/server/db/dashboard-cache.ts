import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { tag } from "@/lib/cache/tags"
import { adminClient } from "@/lib/supabase/admin"

import { buildDashboardData, type DashboardData, type Raw } from "./dashboard"
import { DbError } from "./util"

/**
 * The dashboard, cached on the server per user for 60 s.
 *
 * Security (all four rules):
 * 1. No cookies, headers or session in here: the caller authenticates first
 *    (getSession) and passes the verified user id.
 * 2. The cookieless service-role client calls dashboard_data_for(p_user),
 *    a database function only the service role may run, which filters every
 *    table by that user (tested: A's call never returns B's rows).
 * 3. The user id and the date are the function's arguments, so they are the
 *    cache key: one user's entry can't be served for another.
 * 4. Tagged dashboard:<user>; every change by that user expires it at once
 *    (lib/cache/invalidate). Changes from outside (a client opening a link)
 *    show within a minute.
 */
export async function cachedDashboard(userId: string, today: string): Promise<DashboardData> {
  "use cache"
  cacheTag(tag.dashboard(userId))
  cacheLife({ stale: 60, revalidate: 60, expire: 300 })
  const { data, error } = await adminClient().rpc("dashboard_data_for", { p_user: userId, p_today: today })
  if (error) throw new DbError(error)
  return buildDashboardData(data as Raw, today)
}

/** The server cache needs the service-role key; without it the dashboard reads through RLS. */
export const serverCacheAvailable = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY
