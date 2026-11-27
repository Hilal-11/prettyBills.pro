import { requireUserId } from "@/lib/auth/user"
import { json } from "@/lib/server/http"
import { cancelAtCycleEnd, RazorpayError } from "@/lib/server/razorpay"
import { applySubscription, subscriptionIdOf } from "@/lib/server/subscriptions"

/** POST: stop renewing. Pro stays on until the end of the period already paid for. */
export async function POST() {
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const id = await subscriptionIdOf(auth.userId)
  if (!id) return json({ error: "There's no active subscription to cancel." }, 404)
  try {
    const sub = await cancelAtCycleEnd(id)
    await applySubscription(sub, { cancelAtPeriodEnd: true })
    return json({ ok: true, endsAt: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null })
  } catch (error) {
    console.error("[billing] cancel failed:", error instanceof Error ? error.message : error)
    return json({ error: error instanceof RazorpayError ? error.message : "Couldn't cancel right now. Try again." }, 502)
  }
}
