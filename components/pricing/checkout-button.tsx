"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LoaderIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PaidPlanId } from "@/lib/pricing"

import { CheckoutDialog, type Viewer } from "./checkout-dialog"
import { dataChanged } from "@/lib/client/sync"

/** Where to send someone back to after paying: only the editor's own pages. */
function useReturnTo() {
  const from = useSearchParams().get("from")
  return from && /^\/(create|invoices\/[\w-]{1,96})$/.test(from) ? from : null
}

/** A plan card's button: opens the checkout dialog with that plan picked. */
export function CheckoutButton({ plan, label, primary, viewer, className }: { plan: PaidPlanId; label: string; primary?: boolean; viewer: Viewer; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const returnTo = useReturnTo()
  return (
    <>
      <Button variant={primary ? "default" : "outline"} className={cn("h-10 w-full rounded-lg text-[13px]", className)} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <CheckoutDialog open={open} onOpenChange={setOpen} initialPlan={plan} viewer={viewer} returnTo={returnTo} />
    </>
  )
}

/** Back from logging in with ?checkout=<plan>: open the dialog straight away. */
export function AutoCheckout({ plan, viewer }: { plan: PaidPlanId; viewer: Viewer }) {
  const [open, setOpen] = React.useState(true)
  const returnTo = useReturnTo()
  return <CheckoutDialog open={open} onOpenChange={setOpen} initialPlan={plan} viewer={viewer} returnTo={returnTo} />
}

/** Stops renewal. Pro stays on until the paid period ends. */
export function CancelRenewal({ endsOn }: { endsOn: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function cancel() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/billing/cancel", { method: "POST" }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined
    setBusy(false)
    if (!res?.ok) return setError(data?.error ?? "You seem to be offline. Try again.")
    setOpen(false)
    dataChanged("settings")
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        Cancel renewal
      </button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cancel your Pro renewal?</DialogTitle>
            <DialogDescription>You keep Pro until {endsOn}, and you won&apos;t be charged again. Your invoices, clients and receipts stay as they are.</DialogDescription>
          </DialogHeader>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" className="h-8 text-[13px]" disabled={busy} onClick={() => setOpen(false)}>
              Keep Pro
            </Button>
            <Button variant="destructive" className="h-8 text-[13px]" disabled={busy} onClick={() => void cancel()}>
              {busy && <LoaderIcon className="animate-spin" />} Cancel renewal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
