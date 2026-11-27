import Link from "next/link"
import { CrownIcon } from "lucide-react"

import { getCurrentUser } from "@/lib/auth/user"
import { yearlyPerMonth } from "@/lib/pricing"

import { FeedbackCard } from "./feedback-card"

/**
 * The card above the profile button. Free and guests: what Pro adds and
 * where to get it. Pro: a thank-you and a feedback prompt. Reads the session,
 * so it renders inside Suspense.
 */
export async function SidebarUpgrade() {
  const user = await getCurrentUser()
  if (user?.plan === "Pro") return <FeedbackCard />
  return (
    <div className="relative overflow-hidden rounded-lg border bg-background/70 p-3 group-data-[collapsible=icon]:hidden">
      <div aria-hidden className="pointer-events-none absolute -top-10 -right-8 size-24 rounded-full bg-amber-400/25 blur-2xl" />
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
        <CrownIcon className="size-3.5 text-amber-500" /> PrettyBills Pro
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">Email invoices to clients in one click, with the PDF attached. Everything else stays free.</p>
      <Link
        href="/pricing"
        className="mt-2.5 flex h-7 w-full items-center justify-center rounded-md border bg-background text-xs font-medium transition-colors hover:bg-muted"
      >
        See plans · from ₹{yearlyPerMonth()}/mo
      </Link>
    </div>
  )
}
