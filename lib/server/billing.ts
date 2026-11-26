import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { PlanSummary } from "@/lib/data/types"
import { emailLimitOf, isPaidPlan, type PlanId } from "@/lib/pricing"

import { today } from "./db/util"

/**
 * Which plan a user is on, and how much of it they've used. The database row
 * (written by the payment webhook) is the source of truth; nothing the browser
 * sends can change it. Until payments are live, PRETTYBILL_PRO_USER_IDS
 * (comma-separated user ids) grants Pro by hand, for testing or friends.
 */

export type PlanState = {
  id: PlanId
  pro: boolean
  /** When the paid period ends (renews, or stops if cancelled). */
  renewsAt: string | null
  cancelAtPeriodEnd: boolean
  source: "free" | "subscription" | "grant"
}

const FREE: PlanState = { id: "free", pro: false, renewsAt: null, cancelAtPeriodEnd: false, source: "free" }

/** Razorpay states that still mean "paid up" (pending = a renewal being retried). */
const LIVE = new Set(["authenticated", "active", "pending"])
/** A renewal that's a little late doesn't switch Pro off straight away. */
const GRACE_MS = 3 * 86_400_000

const missingTable = (code?: string) => code === "42P01" || code === "PGRST205"

function granted(userId: string) {
  return (process.env.PRETTYBILL_PRO_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(userId)
}

export async function getPlan(db: SupabaseClient, userId: string): Promise<PlanState> {
  if (granted(userId)) return { id: "pro_yearly", pro: true, renewsAt: null, cancelAtPeriodEnd: false, source: "grant" }
  const { data, error } = await db.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end").eq("user_id", userId).maybeSingle()
  if (error) {
    // before the billing migration runs everyone is on Free; anything else is logged and treated as Free (fails closed)
    if (!missingTable(error.code)) console.error("[billing] couldn't read the plan:", error.message)
    return FREE
  }
  if (!data || !isPaidPlan(data.plan)) return FREE
  const end = data.current_period_end ? Date.parse(data.current_period_end) : null
  const live = LIVE.has(data.status) && (end === null || end + GRACE_MS > Date.now())
  if (!live) return FREE
  return { id: data.plan, pro: true, renewsAt: data.current_period_end, cancelAtPeriodEnd: !!data.cancel_at_period_end, source: "subscription" }
}

/** Start of this month in IST, as an instant. */
const monthStart = () => `${today().slice(0, 7)}-01T00:00:00+05:30`

/** Invoice emails sent through PrettyBills this calendar month (IST). */
export async function emailsThisMonth(db: SupabaseClient) {
  const { count, error } = await db.from("email_sends").select("id", { count: "exact", head: true }).gte("at", monthStart())
  if (error) {
    if (!missingTable(error.code)) console.error("[billing] couldn't count emails:", error.message)
    return 0
  }
  return count ?? 0
}

/** Counts one sent email toward the allowance. Never fails the send that already happened. */
export async function recordEmailSend(db: SupabaseClient, userId: string, send: { invoiceId: string; messageId?: string; recipients: number }) {
  const { error } = await db.from("email_sends").insert({ user_id: userId, invoice_id: send.invoiceId, message_id: send.messageId ?? null, recipients: Math.min(Math.max(send.recipients, 1), 50) })
  if (error && !missingTable(error.code)) console.error("[billing] couldn't record an email:", error.message)
}

/** The plan plus this month's email use, for the editor and settings. */
export async function planSummary(db: SupabaseClient, userId: string): Promise<PlanSummary> {
  const plan = await getPlan(db, userId)
  const limit = emailLimitOf(plan.id)
  const used = limit > 0 ? await emailsThisMonth(db) : 0
  return { id: plan.id, pro: plan.pro, renewsAt: plan.renewsAt, cancelAtPeriodEnd: plan.cancelAtPeriodEnd, emails: { used, limit } }
}
