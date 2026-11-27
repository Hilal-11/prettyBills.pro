import { requireUserId } from "@/lib/auth/user"
import { verifyCheckoutSignature } from "@/lib/billing/razorpay"
import { json } from "@/lib/server/http"
import { fetchSubscription, razorpayEnv, RazorpayError } from "@/lib/server/razorpay"
import { applySubscription } from "@/lib/server/subscriptions"

/**
 * POST { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 * from Checkout's success handler. The signature proves the payment; the
 * subscription must be this user's. Then Pro switches on straight away,
 * without waiting for the webhook (which confirms the same thing).
 */
export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth.response) return auth.response
  const b = (await request.json().catch(() => null)) as { razorpay_payment_id?: string; razorpay_subscription_id?: string; razorpay_signature?: string } | null
  const paymentId = b?.razorpay_payment_id ?? ""
  const subscriptionId = b?.razorpay_subscription_id ?? ""
  if (!verifyCheckoutSignature({ paymentId, subscriptionId, signature: b?.razorpay_signature ?? "" }, razorpayEnv().keySecret ?? "")) {
    console.warn(`[billing] bad checkout signature from ${auth.userId}`)
    return json({ error: "We couldn't confirm that payment. If money left your account, Pro switches on within a few minutes, or write to us." }, 400)
  }
  try {
    const sub = await fetchSubscription(subscriptionId)
    const notes = Array.isArray(sub.notes) ? {} : sub.notes
    if (notes.user_id !== auth.userId) return json({ error: "That payment belongs to a different account." }, 403)
    // paid but Razorpay hasn't moved it on yet: the signature is proof enough, the webhook follows
    const settled = sub.status === "created" ? { ...sub, status: "authenticated" as const } : sub
    const r = await applySubscription(settled)
    console.info(`[billing] verified ${paymentId}: ${r.outcome}`)
    return json({ ok: true, status: settled.status, renewsAt: settled.current_end ? new Date(settled.current_end * 1000).toISOString() : null })
  } catch (error) {
    console.error("[billing] verify failed:", error instanceof Error ? error.message : error)
    return json({ error: error instanceof RazorpayError ? error.message : "Your payment went through, but Pro isn't on yet. It switches on by itself within a few minutes." }, 502)
  }
}
