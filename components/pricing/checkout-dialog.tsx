"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleCheckBigIcon, CrownIcon, LoaderIcon, LockIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { cn } from "cn"

import { BrandMark } from "@/components/brand"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { inr, PLANS, priceOf, type PaidPlanId } from "@/lib/pricing"
import { createClient } from "@/lib/supabase/client"
import { dataChanged } from "@/lib/client/sync"

export type Viewer = { name: string; email: string } | null

type RazorpayResponse = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }
type RazorpayInstance = { open: () => void; on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void }
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Razorpay Checkout's script, loaded once, on first use. */
let script: Promise<void> | null = null
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  script ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = "https://checkout.razorpay.com/v1/checkout.js"
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      script = null
      reject(new Error("Couldn't load Razorpay. Check your connection and try again."))
    }
    document.body.appendChild(s)
  })
  return script
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

/**
 * The upgrade dialog: pick monthly or yearly, then pay in Razorpay's own
 * window (UPI, cards, netbanking). Signed-out visitors first make an account
 * (email or Google) and come straight back here to pay.
 */
export function CheckoutDialog({ open, onOpenChange, initialPlan, viewer, returnTo }: { open: boolean; onOpenChange: (o: boolean) => void; initialPlan: PaidPlanId; viewer: Viewer; returnTo?: string | null }) {
  const router = useRouter()
  const [plan, setPlan] = React.useState<PaidPlanId>(initialPlan)
  const [email, setEmail] = React.useState("")
  const [state, setState] = React.useState<{ step: "idle" | "starting" | "paying" | "verifying" | "done" | "google"; error?: string; renewsAt?: string | null }>({ step: "idle" })
  const [lastOpen, setLastOpen] = React.useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setPlan(initialPlan)
      setState({ step: "idle" })
    }
  }

  const yearly = plan === "pro_yearly"
  const price = inr(priceOf(plan))
  const per = yearly ? "year" : "month"
  const busy = state.step === "starting" || state.step === "paying" || state.step === "verifying" || state.step === "google"
  const back = `/pricing?checkout=${plan}${returnTo ? `&from=${encodeURIComponent(returnTo)}` : ""}`

  async function pay() {
    setState({ step: "starting" })
    try {
      const [res] = await Promise.all([fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) }), loadCheckout()])
      const data = (await res.json().catch(() => ({}))) as { error?: string; keyId?: string; subscriptionId?: string; description?: string; prefill?: { name: string; email: string } }
      if (res.status === 401) {
        onOpenChange(false)
        return router.push(`/login?next=${encodeURIComponent(back)}`)
      }
      if (!res.ok || !data.subscriptionId || !data.keyId || !window.Razorpay) return setState({ step: "idle", error: data.error ?? "Couldn't start checkout. Nothing has been charged; try again." })

      const rzp = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "PrettyBills",
        description: data.description,
        image: `${window.location.origin}/light-icon.png`,
        prefill: { name: data.prefill?.name, email: data.prefill?.email },
        notes: { plan },
        theme: { color: "#0061ff" },
        modal: { ondismiss: () => setState((s) => (s.step === "paying" ? { step: "idle" } : s)) },
        handler: (r: RazorpayResponse) => void confirm(r),
      })
      rzp.on("payment.failed", (r) => setState({ step: "idle", error: r.error?.description ? `Payment failed: ${r.error.description}` : "Payment failed. Nothing has been charged; try again." }))
      setState({ step: "paying" })
      rzp.open()
    } catch (error) {
      setState({ step: "idle", error: error instanceof Error ? error.message : "Couldn't start checkout." })
    }
  }

  async function confirm(r: RazorpayResponse) {
    setState({ step: "verifying" })
    const res = await fetch("/api/billing/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { ok?: boolean; error?: string; renewsAt?: string | null } | undefined
    if (!res?.ok || !data?.ok) return setState({ step: "idle", error: data?.error ?? "Your payment went through, but Pro isn't on yet. It switches on by itself within a few minutes." })
    setState({ step: "done", renewsAt: data.renewsAt })
    window.history.replaceState(null, "", window.location.pathname)
    dataChanged("settings")
    router.refresh()
  }

  async function google() {
    setState({ step: "google" })
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(back)}` } })
    if (error) setState({ step: "idle", error: "Google sign-in didn't work. Try again, or use your email." })
  }

  function withEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL.test(email.trim())) return setState({ step: "idle", error: "Enter a valid email address." })
    onOpenChange(false)
    router.push(`/signup?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(back)}`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (busy && state.step !== "google" ? undefined : onOpenChange(o))}>
      <DialogContent className="gap-0 p-0 sm:max-w-[440px]">
        {state.step === "done" ? (
          <div className="grid justify-items-center gap-3 px-6 py-9 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CircleCheckBigIcon className="size-6" />
            </span>
            <DialogTitle className="text-lg">You&apos;re on Pro</DialogTitle>
            <DialogDescription className="max-w-xs text-[13px]">
              Thanks for backing PrettyBills. Emailing invoices and receipts is on now{state.renewsAt ? `, and your plan renews on ${longDate(state.renewsAt)}` : ""}. Razorpay has emailed you the payment receipt.
            </DialogDescription>
            {returnTo ? (
              <Link href={returnTo} className={cn(buttonVariants(), "mt-2 h-10 w-full rounded-lg text-[13px]")}>
                Back to your invoice
              </Link>
            ) : (
              <Button className="mt-2 h-10 w-full rounded-lg text-[13px]" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 p-6">
            <div className="flex items-center gap-4">
              <ProductTile />
              <div className="min-w-0">
                <DialogTitle className="text-[17px] font-semibold tracking-[-0.01em]">Pro · {yearly ? "Yearly" : "Monthly"}</DialogTitle>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-tight font-semibold tracking-[-0.02em] tabular-nums">{price}</span>
                  <span className="text-[13px] text-muted-foreground">/ {per}</span>
                </p>
              </div>
            </div>

            <div role="radiogroup" aria-label="Billing period" className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/50 p-1">
              {(["pro_yearly", "pro_monthly"] as const).map((p) => {
                const on = plan === p
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={busy}
                    onClick={() => setPlan(p)}
                    className={cn("flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50", on ? "border bg-background font-medium text-foreground shadow-xs" : "text-foreground/60 hover:text-foreground")}
                  >
                    {p === "pro_yearly" ? "Yearly" : "Monthly"} · {inr(priceOf(p))}
                    {p === "pro_yearly" && PLANS.pro_yearly.savingsLabel && <span className="rounded bg-emerald-500/12 px-1 py-px text-[10px] font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">{PLANS.pro_yearly.savingsLabel}</span>}
                  </button>
                )
              })}
            </div>

            <DialogDescription className="text-center text-[13px] leading-relaxed text-foreground/70">
              {price} is charged today and then every {per}. Cancel any time from Billing &amp; plan, and you keep Pro until the end of the {per} you&apos;ve paid for.
            </DialogDescription>

            {viewer ? (
              <div className="grid gap-2.5">
                <Input value={viewer.email} readOnly aria-label="Account" className="h-11 rounded-xl bg-background text-sm md:text-sm" />
                <Button className="h-11 rounded-xl text-[14px] font-semibold" disabled={busy} onClick={() => void pay()}>
                  {busy ? <LoaderIcon className="animate-spin" /> : <LockIcon />}
                  {state.step === "verifying" ? "Confirming payment…" : state.step === "paying" ? "Complete payment in Razorpay…" : `Checkout · ${price}`}
                </Button>
                <p className="text-center text-xs text-muted-foreground">Pro is added to the account above.</p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                <form onSubmit={withEmail} noValidate className="grid gap-2.5">
                  <Input type="email" autoComplete="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl bg-background text-sm md:text-sm" />
                  <Button type="submit" className="h-11 rounded-xl text-[14px] font-semibold" disabled={busy}>
                    Continue with email
                  </Button>
                </form>
                <Button variant="outline" className="h-11 rounded-xl text-[13px]" disabled={busy} onClick={() => void google()}>
                  {state.step === "google" ? <LoaderIcon className="animate-spin" /> : <FcGoogle className="size-4" />} Continue with Google
                </Button>
                <p className="text-center text-xs leading-relaxed text-muted-foreground">Pro is tied to your PrettyBills account. After signing in you&apos;ll come straight back here to pay.</p>
              </div>
            )}

            {state.error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-[13px] text-destructive">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" /> {state.error}
              </p>
            )}

            <p className="flex items-center justify-center gap-1.5 border-t border-dashed pt-4 text-xs text-muted-foreground">
              <ShieldCheckIcon className="size-3.5" /> Secure payment via Razorpay · UPI, cards, netbanking
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The dark "PrettyBills Pro" card at the top of the dialog. */
function ProductTile() {
  return (
    <div aria-hidden className="relative grid h-[84px] w-[132px] shrink-0 place-items-center overflow-hidden rounded-xl bg-[radial-gradient(120%_90%_at_100%_0%,#1f3a8a_0%,#0b0b0f_55%)] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)] ring-1 ring-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.18)_1px,transparent_1.2px)] [background-size:9px_9px] opacity-40 [mask-image:radial-gradient(80%_80%_at_80%_10%,black,transparent)]" />
      <div className="relative grid justify-items-center gap-1.5">
        <BrandMark size={26} />
        <span className="flex items-center gap-1 text-[12px] font-semibold tracking-tight text-white">
          PrettyBills
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-400 px-1 py-px text-[10px] font-bold text-amber-950">
            <CrownIcon className="size-2.5" /> Pro
          </span>
        </span>
      </div>
    </div>
  )
}
