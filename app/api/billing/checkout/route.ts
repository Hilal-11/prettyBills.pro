import { getCurrentUser } from "@/lib/auth/user"
import { isPaidPlan, PLANS, priceOf } from "@/lib/pricing"
import { getPlan } from "@/lib/server/billing"
import { json } from "@/lib/server/http"
import { checkoutProblems, createSubscription, publicKeyId, RazorpayError } from "@/lib/server/razorpay"
import { rateLimit } from "@/lib/server/rate-limit"
import { openCheckout, recordCreated } from "@/lib/server/subscriptions"
import { createClient } from "@/lib/supabase/server"

/**
 * POST { plan: "pro_monthly" | "pro_yearly" } → what Razorpay Checkout needs
 * to open: the public key id and a subscription made for this user. Nothing
 * is charged here; the payment happens in Razorpay's window and is confirmed
 * by /api/billing/verify and the webhook.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return json({ error: "Log in to upgrade." }, 401)
  const limit = rateLimit(`checkout:${user.id}`, 10, 10 * 60_000)
  if (!limit.ok) return json({ error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` }, 429)

  const body = (await request.json().catch(() => null)) as { plan?: string } | null
  const plan = body?.plan
  if (!plan || !isPaidPlan(plan)) return json({ error: "Choose a plan" }, 422)

  const problems = checkoutProblems(plan)
  if (problems.length) {
    console.error(`[billing] checkout for ${plan} is off:\n  - ${problems.join("\n  - ")}`)
    return json({ error: "Payments aren't switched on yet. Nothing has been charged; please try again soon." }, 503)
  }

  const current = await getPlan(await createClient(), user.id)
  if (current.pro) return json({ error: current.id === plan ? "You're already on this plan." : "You already have Pro. To switch, cancel renewal and pick the other plan when it ends." }, 409)

  try {
    let subscriptionId = await openCheckout(user.id, plan)
    if (!subscriptionId) {
      const sub = await createSubscription(plan, user.id, user.email)
      await recordCreated(user.id, plan, sub)
      subscriptionId = sub.id
    }
    return json({
      keyId: publicKeyId(),
      subscriptionId,
      plan,
      amount: priceOf(plan) * 100,
      description: `PrettyBills Pro · ${PLANS[plan].interval === "year" ? "Yearly" : "Monthly"}`,
      prefill: { name: user.name, email: user.email },
    })
  } catch (error) {
    if (error instanceof RazorpayError) return json({ error: error.message }, error.status)
    console.error("[billing] checkout failed:", error instanceof Error ? error.message : error)
    return json({ error: error instanceof Error && /already have/.test(error.message) ? error.message : "Couldn't start checkout. Nothing has been charged; try again." }, 500)
  }
}
