import "server-only"

import { fromUnix } from "@/lib/billing/razorpay"
import { isPaidPlan, type PaidPlanId } from "@/lib/pricing"
import { adminClient } from "@/lib/supabase/admin"

import { planForRazorpayPlan, type RazorpaySubscription } from "./razorpay"

/**
 * Writes what Razorpay says about a subscription into public.subscriptions.
 * Only the server does this (service role): the browser can start a
 * checkout, but only a verified Razorpay signature or webhook makes anyone Pro.
 */

const LIVE = new Set(["authenticated", "active", "pending"])

type Row = { user_id: string; plan: PaidPlanId; status: string; razorpay_subscription_id: string | null; current_period_end: string | null }

/** A checkout was opened: remember the subscription so its events find the user. Never replaces a live one. */
export async function recordCreated(userId: string, plan: PaidPlanId, sub: RazorpaySubscription) {
  const db = adminClient()
  const { data: existing, error: readError } = await db.from("subscriptions").select("status, current_period_end").eq("user_id", userId).maybeSingle()
  if (readError) throw new Error(`Couldn't read the subscription: ${readError.message}`)
  if (existing && LIVE.has(existing.status) && (!existing.current_period_end || Date.parse(existing.current_period_end) > Date.now())) {
    throw new Error("You already have an active Pro subscription.")
  }
  const { error } = await db.from("subscriptions").upsert(
    { user_id: userId, plan, status: "created", razorpay_subscription_id: sub.id, razorpay_customer_id: sub.customer_id, current_period_end: null, cancel_at_period_end: false },
    { onConflict: "user_id" }
  )
  if (error) throw new Error(`Couldn't save the subscription: ${error.message}`)
}

/** An unpaid checkout opened recently for the same plan, to reuse instead of making another. */
export async function openCheckout(userId: string, plan: PaidPlanId) {
  const { data } = await adminClient().from("subscriptions").select("plan, status, razorpay_subscription_id, updated_at").eq("user_id", userId).maybeSingle()
  if (data?.status === "created" && data.plan === plan && data.razorpay_subscription_id && Date.now() - Date.parse(data.updated_at) < 20 * 3600_000) return data.razorpay_subscription_id as string
  return null
}

/**
 * Applies a subscription's latest state. Finds the row by subscription id,
 * or by the user id we put in its notes at checkout. An event about an old
 * subscription never overwrites a newer one that's live.
 */
export async function applySubscription(sub: RazorpaySubscription, opts: { cancelAtPeriodEnd?: boolean } = {}): Promise<{ userId: string | null; outcome: string }> {
  const db = adminClient()
  const notes = Array.isArray(sub.notes) ? {} : sub.notes
  const plan = planForRazorpayPlan(sub.plan_id) ?? (isPaidPlan(notes.plan ?? "") ? (notes.plan as PaidPlanId) : null)
  if (!plan) return { userId: null, outcome: `ignored: plan ${sub.plan_id} isn't a PrettyBills plan` }

  const { data: bySub } = await db.from("subscriptions").select("user_id, plan, status, razorpay_subscription_id, current_period_end").eq("razorpay_subscription_id", sub.id).maybeSingle<Row>()
  let row = bySub
  const userId = row?.user_id ?? (typeof notes.user_id === "string" && /^[0-9a-f-]{36}$/.test(notes.user_id) ? notes.user_id : null)
  if (!userId) return { userId: null, outcome: "ignored: no user for this subscription" }

  if (!row) {
    const { data: byUser } = await db.from("subscriptions").select("user_id, plan, status, razorpay_subscription_id, current_period_end").eq("user_id", userId).maybeSingle<Row>()
    const liveOther = byUser && byUser.razorpay_subscription_id !== sub.id && LIVE.has(byUser.status) && (!byUser.current_period_end || Date.parse(byUser.current_period_end) > Date.now())
    if (liveOther && !LIVE.has(sub.status)) return { userId, outcome: `ignored: ${sub.id} is ${sub.status}, user has a live subscription` }
    row = byUser
  }

  const patch: Record<string, unknown> = {
    user_id: userId,
    plan,
    status: sub.status,
    razorpay_subscription_id: sub.id,
    current_period_end: fromUnix(sub.current_end) ?? row?.current_period_end ?? null,
  }
  if (sub.customer_id) patch.razorpay_customer_id = sub.customer_id
  if (opts.cancelAtPeriodEnd !== undefined) patch.cancel_at_period_end = opts.cancelAtPeriodEnd
  else if (sub.status === "cancelled" || sub.status === "completed" || sub.status === "expired") patch.cancel_at_period_end = false

  const { error } = await db.from("subscriptions").upsert(patch, { onConflict: "user_id" })
  if (error) throw new Error(`Couldn't update the subscription: ${error.message}`)
  return { userId, outcome: `${sub.id} → ${sub.status}${patch.current_period_end ? ` until ${patch.current_period_end}` : ""}` }
}

/** The user's Razorpay subscription id, for cancelling. */
export async function subscriptionIdOf(userId: string) {
  const { data } = await adminClient().from("subscriptions").select("razorpay_subscription_id, status").eq("user_id", userId).maybeSingle()
  return data && LIVE.has(data.status) ? (data.razorpay_subscription_id as string | null) : null
}
