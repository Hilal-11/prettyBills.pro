import { optionalUserId } from "@/lib/auth/user"
import { isFeedbackTopic } from "@/lib/feedback"
import { json } from "@/lib/server/http"
import { clientIp, rateLimit } from "@/lib/server/rate-limit"
import { writeFeedbackLocally } from "@/lib/server/store"
import { createClient } from "@/lib/supabase/server"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Body = { topic?: unknown; message?: unknown; mood?: unknown; email?: unknown; page?: unknown }

/**
 * Feedback from the dashboard and the help center. Open to guests.
 * Rows go to public.feedback (insert-only for clients, see the migration).
 * Limited to 5 messages per 10 minutes per person.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null
  if (!body) return json({ error: "Invalid request" }, 400)

  const message = typeof body.message === "string" ? body.message.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim() : ""
  const mood = typeof body.mood === "number" && Number.isInteger(body.mood) && body.mood >= 1 && body.mood <= 4 ? body.mood : null
  if (!isFeedbackTopic(body.topic)) return json({ error: "Pick a topic." }, 422)
  if (message.length < 3) return json({ error: "Write a few words so we know what you mean." }, 422)
  if (message.length > 2000) return json({ error: "Keep it under 2,000 characters." }, 422)
  if (email && (email.length > 254 || !EMAIL.test(email))) return json({ error: "That email doesn't look right." }, 422)

  const userId = await optionalUserId()
  const limit = rateLimit(`feedback:${userId ?? clientIp(request)}`, 5, 10 * 60_000)
  if (!limit.ok) return Response.json({ error: `You've sent a lot of feedback. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } })

  const row = {
    user_id: userId,
    topic: body.topic,
    message,
    mood,
    email: userId ? null : email || null,
    page: typeof body.page === "string" ? body.page.slice(0, 512) : null,
    user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
  }

  const supabase = await createClient()
  const { error } = await supabase.from("feedback").insert(row)
  if (!error) return json({ ok: true })

  // the table doesn't exist until the feedback migration is run: keep it locally in development
  if (process.env.NODE_ENV !== "production") {
    const file = await writeFeedbackLocally({ ...row, created_at: new Date().toISOString(), supabase_error: error.message })
    console.warn(`[feedback] Supabase insert failed (${error.message}). Saved to ${file}. Run supabase/migrations/*_feedback.sql.`)
    return json({ ok: true, stored: "local" })
  }
  console.error("[feedback] insert failed:", error.message)
  return json({ error: "Couldn't send that right now. Try again in a moment." }, 503)
}
