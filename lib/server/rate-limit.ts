/**
 * Small in-memory sliding-window limiter, per server instance. Enough to stop
 * one visitor hammering an expensive route; use a shared store (e.g. Redis)
 * if you run several instances and need a hard global limit.
 */
const hits = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return { ok: false as const, retryAfter: Math.ceil((windowMs - (now - recent[0]!)) / 1000) }
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k)
  return { ok: true as const }
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local"
}
