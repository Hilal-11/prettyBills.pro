"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import type { PaidPlanId } from "@/lib/pricing"

/**
 * Starts paying for a plan. The server answers with where to pay (Razorpay,
 * once it's connected); until then it explains that checkout isn't open yet.
 */
export function CheckoutButton({ plan, label, primary, className }: { plan: PaidPlanId; label: string; primary?: boolean; className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [note, setNote] = React.useState<string | null>(null)

  async function start() {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/pricing")}`)
        return
      }
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setNote(data.error ?? "Couldn't start checkout. Try again.")
    } catch {
      setNote("You seem to be offline. Check your connection and try again.")
    }
    setBusy(false)
  }

  return (
    <div className="grid gap-2">
      <Button variant={primary ? "default" : "outline"} className={cn("h-10 w-full rounded-lg text-[13px]", className)} disabled={busy} onClick={() => void start()}>
        {busy && <LoaderIcon className="animate-spin" />}
        {label}
      </Button>
      <p aria-live="polite" className={cn("text-center text-xs text-muted-foreground", !note && "sr-only")}>
        {note}
      </p>
    </div>
  )
}
