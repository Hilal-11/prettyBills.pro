import { requireUserId } from "@/lib/auth/user"
import { isPaidPlan } from "@/lib/pricing"
import { getPlan } from "@/lib/server/billing"
import { json } from "@/lib/server/http"
import { createClient } from "@/lib/supabase/server"

/**
 * Starts a Pro subscription. Body: { plan: "pro_monthly" | "pro_yearly" }.
 * Will answer { url } to send the buyer to. Payment itself (Razorpay) is the
 * next step; until then this says checkout isn't open yet, and nothing is charged.
 */
export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const body = (await request.json().catch(() => null)) as { plan?: string } | null
  const plan = body?.plan
  if (!plan || !isPaidPlan(plan)) return json({ error: "Choose a plan" }, 422)

  const db = await createClient()
  const current = await getPlan(db, auth.userId)
  if (current.pro && current.id === plan) return json({ error: "You're already on this plan." }, 409)

  // next: create a Razorpay subscription for PLANS[plan].razorpayPlanId and return its checkout url
  return json({ error: "Checkout opens very soon. Nothing has been charged." }, 503)
}
