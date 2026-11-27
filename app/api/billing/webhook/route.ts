import { verifyWebhookSignature } from "@/lib/billing/razorpay"
import { json } from "@/lib/server/http"
import { razorpayEnv, type RazorpaySubscription } from "@/lib/server/razorpay"
import { applySubscription } from "@/lib/server/subscriptions"
import { adminClient } from "@/lib/supabase/admin"

/**
 * Razorpay webhook. Set it up in Razorpay → Settings → Webhooks:
 * URL https://<your domain>/api/billing/webhook, the secret from
 * RAZORPAY_WEBHOOK_SECRET, and the subscription.* events.
 *
 * Signed over the raw body; each event id is handled once (billing_events).
 * Answers 200 for anything it chooses to ignore, so Razorpay doesn't retry it.
 */
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"), razorpayEnv().webhookSecret ?? "")) {
    console.warn("[billing] webhook with a bad signature")
    return json({ error: "Invalid signature" }, 400)
  }

  let body: { event?: string; payload?: { subscription?: { entity?: RazorpaySubscription } } }
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }
  const event = body.event ?? "unknown"
  const sub = body.payload?.subscription?.entity
  const eventId = (request.headers.get("x-razorpay-event-id") ?? `${event}:${sub?.id ?? "none"}:${raw.length}`).slice(0, 100)
  const db = adminClient()

  // a retried delivery of an event already handled
  const { error: logError } = await db.from("billing_events").insert({ id: eventId, event: event.slice(0, 60), subscription_id: sub?.id ?? null, payload: body })
  if (logError?.code === "23505") return json({ ok: true, duplicate: true })
  if (logError) console.warn(`[billing] couldn't log webhook ${eventId}: ${logError.message}`)

  if (!event.startsWith("subscription.") || !sub?.id) return json({ ok: true, ignored: event })

  try {
    const r = await applySubscription(sub)
    console.info(`[billing] ${event}: ${r.outcome}`)
    if (!logError) await db.from("billing_events").update({ user_id: r.userId, outcome: r.outcome.slice(0, 200) }).eq("id", eventId)
    return json({ ok: true })
  } catch (error) {
    // 500 makes Razorpay retry later; drop the log row so the retry is handled
    console.error(`[billing] webhook ${event} failed:`, error instanceof Error ? error.message : error)
    if (!logError) await db.from("billing_events").delete().eq("id", eventId)
    return json({ error: "Couldn't apply the event" }, 500)
  }
}
