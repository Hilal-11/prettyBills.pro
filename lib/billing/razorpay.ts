/**
 * Razorpay checks that don't need the network: signatures and configuration.
 * Pure (node:crypto only), so they're unit tested.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex")

/**
 * After Checkout succeeds for a subscription, Razorpay hands the browser a
 * signature over "<payment id>|<subscription id>". Only someone with the key
 * secret can make it, so a valid one proves the payment really happened.
 */
export function verifyCheckoutSignature(o: { paymentId: string; subscriptionId: string; signature: string }, keySecret: string) {
  if (!o.paymentId || !o.subscriptionId || !o.signature || !keySecret) return false
  return safeEqual(hmac(keySecret, `${o.paymentId}|${o.subscriptionId}`), o.signature)
}

/** Webhooks are signed over the exact raw body with the webhook secret (X-Razorpay-Signature). */
export function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string) {
  if (!signature || !webhookSecret) return false
  return safeEqual(hmac(webhookSecret, rawBody), signature)
}

export type RazorpayEnv = {
  keyId?: string
  keySecret?: string
  planMonthly?: string
  planYearly?: string
  webhookSecret?: string
  serviceRoleKey?: string
}

/**
 * What's wrong with the configuration, in words a person can fix. Empty when
 * everything checkout needs is in place. Catches the usual mix-ups: the key
 * id pasted as the secret, a subscription id (sub_…) where a plan id (plan_…)
 * belongs.
 */
export function razorpayProblems(env: RazorpayEnv, needs: { plan?: "monthly" | "yearly"; webhook?: boolean } = {}) {
  const problems: string[] = []
  if (!env.keyId) problems.push("RAZORPAY_KEY_ID is missing.")
  else if (!/^rzp_(live|test)_\w+$/.test(env.keyId)) problems.push("RAZORPAY_KEY_ID should look like rzp_live_… or rzp_test_….")
  if (!env.keySecret) problems.push("RAZORPAY_KEY_SECRET is missing.")
  else if (env.keySecret === env.keyId || env.keySecret.startsWith("rzp_")) problems.push("RAZORPAY_KEY_SECRET is the key id, not the secret. Copy the Key Secret shown when the key was generated (Razorpay → Settings → API Keys; regenerate if you no longer have it).")
  const check = (name: string, value: string | undefined) => {
    if (!value) problems.push(`${name} is missing. Create the plan in Razorpay → Subscriptions → Plans and paste its id (plan_…).`)
    else if (value.startsWith("sub_")) problems.push(`${name} is a subscription id (sub_…). It needs the plan id, which starts with plan_.`)
    else if (!value.startsWith("plan_")) problems.push(`${name} should start with plan_.`)
  }
  if (needs.plan === "monthly") check("RAZORPAY_PLAN_ID_MONTHLY", env.planMonthly)
  if (needs.plan === "yearly") check("RAZORPAY_PLAN_ID_YEARLY", env.planYearly)
  if (needs.webhook && !env.webhookSecret) problems.push("RAZORPAY_WEBHOOK_SECRET is missing.")
  if (!env.serviceRoleKey) problems.push("SUPABASE_SERVICE_ROLE_KEY is missing (the server needs it to record subscriptions).")
  return problems
}

/** Razorpay times are Unix seconds. */
export const fromUnix = (s: number | null | undefined) => (typeof s === "number" && s > 0 ? new Date(s * 1000).toISOString() : null)
