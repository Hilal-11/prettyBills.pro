"use client"

import { Button } from "@/components/ui/button"

import { useDashboardUI } from "./dashboard-ui"

/** For Pro members (who have everything): asks what to build next. */
export function FeedbackCard() {
  const ui = useDashboardUI()
  return (
    <div className="rounded-lg border bg-background/70 p-3 group-data-[collapsible=icon]:hidden">
      <p className="text-[13px] font-semibold">Thanks for backing PrettyBills</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Reminders, scheduled sends and recurring invoices are next. What should we build first?</p>
      <Button variant="outline" size="sm" className="mt-2.5 h-7 w-full text-xs" onClick={() => ui.openFeedback("idea")}>
        Tell us
      </Button>
    </div>
  )
}
