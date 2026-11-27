import { cache } from "react"
import Link from "next/link"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth/user"
import { getPlan, type PlanState } from "@/lib/server/billing"
import { getSession } from "@/lib/server/session"
import { isPaidPlan, type PlanId } from "@/lib/pricing"

import { AutoCheckout, CancelRenewal, CheckoutButton } from "./checkout-button"
import type { Viewer } from "./checkout-dialog"

/** The visitor (null for guests) and their plan, read once per request for all three cards. */
const viewerState = cache(async (): Promise<{ viewer: Viewer; plan: PlanState | null }> => {
  const [session, user] = await Promise.all([getSession(), getCurrentUser()])
  if (!session || !user) return { viewer: null, plan: null }
  return { viewer: { name: user.name, email: user.email }, plan: await getPlan(session.db, session.userId) }
})

const btn = (primary?: boolean) => cn(buttonVariants({ variant: primary ? "default" : "outline" }), "h-10 w-full rounded-lg text-[13px]")

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

function Current({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <span aria-disabled className={cn(btn(), "pointer-events-none opacity-70")}>
        {children}
      </span>
      {note && <div className="flex flex-wrap items-center justify-center gap-x-2 text-center text-xs text-muted-foreground">{note}</div>}
    </div>
  )
}

/**
 * Each card's button, which depends on who's looking. Paid plans open the
 * checkout dialog (guests sign in from inside it); Pro members see what they
 * have, when it renews, and can cancel renewal.
 * Streams in behind Suspense, so the page itself stays static.
 */
export async function PlanCta({ plan, primary }: { plan: PlanId; primary?: boolean }) {
  const { viewer, plan: current } = await viewerState()

  if (plan === "free") {
    if (!viewer)
      return (
        <Link href="/create" className={btn(primary)}>
          Start for free
        </Link>
      )
    return <Current>{current?.pro ? "Included in Pro" : "Your current plan"}</Current>
  }

  if (current?.pro) {
    if (current.source === "grant") return <Current>You have Pro</Current>
    if (current.id === plan) {
      const end = current.renewsAt ? longDate(current.renewsAt) : null
      return (
        <Current
          note={
            end && (
              <>
                <span>{current.cancelAtPeriodEnd ? `Ends on ${end}` : `Renews on ${end}`}</span>
                {!current.cancelAtPeriodEnd && <CancelRenewal endsOn={end} />}
              </>
            )
          }
        >
          Your current plan
        </Current>
      )
    }
    return <Current note="To switch, cancel renewal and choose this plan when yours ends.">You have Pro</Current>
  }

  return <CheckoutButton plan={plan} primary={primary} viewer={viewer} label={viewer ? "Upgrade to Pro" : "Get Pro"} />
}

/** /pricing?checkout=<plan>: someone came back from logging in to pay. Opens the dialog for them. */
export async function ResumeCheckout({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const plan = typeof sp.checkout === "string" && isPaidPlan(sp.checkout) ? sp.checkout : null
  if (!plan) return null
  const { viewer, plan: current } = await viewerState()
  if (!viewer || current?.pro) return null
  return <AutoCheckout plan={plan} viewer={viewer} />
}

export function PlanCtaSkeleton() {
  return <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
}
