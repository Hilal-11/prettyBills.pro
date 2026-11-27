import "server-only"

import { razorpayProblems, type RazorpayEnv } from "@/lib/billing/razorpay"
import { PLANS, priceOf, type PaidPlanId } from "@/lib/pricing"

/**
 * Razorpay Subscriptions over its REST API (https://razorpay.com/docs/api/payments/subscriptions/).
 * Keys come from the environment and never reach the browser, except the
 * public key id, which Checkout needs.
 */

export function razorpayEnv(): RazorpayEnv {
  return {
    keyId: process.env.RAZORPAY_KEY_ID?.trim(),
    keySecret: process.env.RAZORPAY_KEY_SECRET?.trim(),
    planMonthly: (process.env.RAZORPAY_PLAN_ID_MONTHLY ?? process.env.RZP_PLAN_PRO_MONTHLY)?.trim(),
    planYearly: (process.env.RAZORPAY_PLAN_ID_YEARLY ?? process.env.RZP_PLAN_PRO_YEARLY)?.trim(),
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  }
}

export const intervalOf = (plan: PaidPlanId) => (PLANS[plan].interval === "year" ? "yearly" : "monthly")

export function planIdFor(plan: PaidPlanId) {
  const env = razorpayEnv()
  return plan === "pro_yearly" ? env.planYearly : env.planMonthly
}

/** Our plan for a Razorpay plan id, or null if it isn't one of ours. */
export function planForRazorpayPlan(planId: string | null | undefined): PaidPlanId | null {
  if (!planId) return null
  const env = razorpayEnv()
  if (planId === env.planMonthly) return "pro_monthly"
  if (planId === env.planYearly) return "pro_yearly"
  return null
}

export class RazorpayError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = "RazorpayError"
    this.status = status
  }
}

async function api<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { keyId, keySecret } = razorpayEnv()
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string; code?: string } }
  if (!res.ok) {
    const why = data.error?.description ?? `HTTP ${res.status}`
    console.error(`[razorpay] ${method} ${path.split("?")[0]} failed: ${why}`)
    throw new RazorpayError(res.status === 401 ? "Payments aren't set up correctly yet (Razorpay rejected the API keys)." : `Razorpay: ${why}`, res.status === 401 ? 503 : 502)
  }
  return data
}

export type RazorpaySubscription = {
  id: string
  plan_id: string
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired" | "paused"
  current_start: number | null
  current_end: number | null
  ended_at: number | null
  customer_id: string | null
  notes: Record<string, string> | []
  short_url?: string
}

type RazorpayPlan = { id: string; period: string; interval: number; item: { amount: number; currency: string } }

/** Plans checked against our prices, remembered for 10 minutes. */
const checked = new Map<string, number>()

/**
 * Refuses to sell a plan whose Razorpay price or period doesn't match what
 * /pricing shows, so nobody is charged a different amount than they agreed to.
 */
async function assertPlanMatches(plan: PaidPlanId, planId: string) {
  const at = checked.get(planId)
  if (at && Date.now() - at < 10 * 60_000) return
  const p = await api<RazorpayPlan>("GET", `/plans/${encodeURIComponent(planId)}`)
  const want = priceOf(plan) * 100
  const period = intervalOf(plan)
  if (p.item.amount !== want || p.item.currency !== "INR" || p.period !== period || p.interval !== 1) {
    console.error(`[razorpay] plan ${planId} is ${p.item.currency} ${p.item.amount / 100} every ${p.interval} ${p.period}; /pricing says ₹${want / 100} ${period}. Fix one of them.`)
    throw new RazorpayError("This plan's price is being updated. Nothing has been charged; try again in a little while.", 503)
  }
  checked.set(planId, Date.now())
}

/** Problems that stop checkout for this plan, for the logs. Empty when it's ready. */
export function checkoutProblems(plan: PaidPlanId) {
  return razorpayProblems(razorpayEnv(), { plan: intervalOf(plan) })
}

export async function createSubscription(plan: PaidPlanId, userId: string, email: string) {
  const planId = planIdFor(plan)!
  await assertPlanMatches(plan, planId)
  return api<RazorpaySubscription>("POST", "/subscriptions", {
    plan_id: planId,
    // monthly for 5 years, yearly for 5 years; people can cancel any time
    total_count: plan === "pro_yearly" ? 5 : 60,
    quantity: 1,
    customer_notify: 1,
    // an unpaid checkout lapses after a day
    expire_by: Math.floor(Date.now() / 1000) + 24 * 3600,
    notes: { user_id: userId, plan, email },
  })
}

export const fetchSubscription = (id: string) => api<RazorpaySubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`)

/** Stops renewal; Pro stays on until the end of the period already paid for. */
export const cancelAtCycleEnd = (id: string) => api<RazorpaySubscription>("POST", `/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: 1 })

export const publicKeyId = () => razorpayEnv().keyId ?? ""
