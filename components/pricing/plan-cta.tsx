import { cache } from "react"
import Link from "next/link"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"
import { getPlan, type PlanState } from "@/lib/server/billing"
import { getSession } from "@/lib/server/session"
import { PLANS, type PlanId } from "@/lib/pricing"

import { CheckoutButton } from "./checkout-button"

/** The visitor's plan (null for guests), read once per request for all three cards. */
const viewerPlan = cache(async (): Promise<PlanState | null> => {
  const session = await getSession()
  return session ? getPlan(session.db, session.userId) : null
})

const btn = (primary?: boolean) => cn(buttonVariants({ variant: primary ? "default" : "outline" }), "h-10 w-full rounded-lg text-[13px]")

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

function Current({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="grid gap-2">
      <span aria-disabled className={cn(btn(), "pointer-events-none opacity-70")}>
        {children}
      </span>
      {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/**
 * Each card's button, which depends on who's looking: guests are sent to sign
 * up, Free members to checkout, and Pro members see what they have.
 * Streams in behind Suspense, so the page itself stays static.
 */
export async function PlanCta({ plan, primary }: { plan: PlanId; primary?: boolean }) {
  const viewer = await viewerPlan()

  if (plan === "free") {
    if (!viewer)
      return (
        <Link href="/create" className={btn(primary)}>
          Start for free
        </Link>
      )
    return <Current>{viewer.pro ? "Included in Pro" : "Your current plan"}</Current>
  }

  if (!viewer)
    return (
      <Link href={`/signup?next=${encodeURIComponent("/pricing")}`} className={btn(primary)}>
        Get Pro
      </Link>
    )

  if (viewer.pro) {
    if (viewer.source === "grant") return <Current>You have Pro</Current>
    if (viewer.id === plan) {
      const note = viewer.renewsAt ? `${viewer.cancelAtPeriodEnd ? "Ends" : "Renews"} on ${longDate(viewer.renewsAt)}` : undefined
      return <Current note={note}>Your current plan</Current>
    }
    return <CheckoutButton plan={plan} primary={primary} label={`Switch to ${PLANS[plan].interval === "year" ? "yearly" : "monthly"}`} />
  }

  return <CheckoutButton plan={plan} primary={primary} label="Upgrade to Pro" />
}

export function PlanCtaSkeleton() {
  return <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
}
