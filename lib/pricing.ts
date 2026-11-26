/**
 * Plans and prices. Everything that makes and shares an invoice is free; Pro
 * pays for the one thing that costs money per use: email sent from
 * PrettyBills (through Resend). The editor, the send API and /pricing all
 * read from here, so a price or limit changes in one place.
 */
import type { PlanSummary } from "@/lib/data/types"

const PRO_FEATURES = {
  manualEmailSend: true,
  autoReminders: true,
  scheduledSend: true,
  recurringAutoSend: true,
  autoReceiptEmail: true,
  removeBranding: true,
} as const

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyINR: 0,
    // Emailing is Pro-only. Set a number (say 30) to give free accounts a
    // monthly allowance: the editor and the send API both follow it.
    limits: { manualEmailsPerMonth: 0 },
    features: {
      manualEmailSend: false,
      autoReminders: false,
      scheduledSend: false,
      recurringAutoSend: false,
      autoReceiptEmail: false,
      removeBranding: false,
    },
  },
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro",
    interval: "month",
    priceINR: 149,
    launchPriceINR: 99,
    razorpayPlanId: process.env.RZP_PLAN_PRO_MONTHLY,
    limits: { emailsPerMonth: 1000 }, // fair use
    features: PRO_FEATURES,
  },
  pro_yearly: {
    id: "pro_yearly",
    name: "Pro",
    interval: "year",
    priceINR: 1199,
    launchPriceINR: 799,
    savingsLabel: "Save 33%",
    razorpayPlanId: process.env.RZP_PLAN_PRO_YEARLY,
    limits: { emailsPerMonth: 1000 },
    features: PRO_FEATURES,
  },
} as const

export const COSTS = {
  resendPlan: "Pro",
  resendMonthlyUSD: 20,
  resendIncludedEmails: 50000,
  resendOveragePer1000USD: 0.9,
  usdToInr: 90, // update when needed
  gatewayFeePct: 2.36, // Razorpay 2% + 18% GST on fee
  pricesIncludeGST: true,
}

export type PlanId = keyof typeof PLANS
export type PaidPlanId = Exclude<PlanId, "free">
export type Feature = keyof typeof PRO_FEATURES

/** While true, paid plans sell at launchPriceINR with priceINR struck through. Off: priceINR is the price. */
export const LAUNCH_OFFER = false

export const isPaidPlan = (id: string): id is PaidPlanId => id === "pro_monthly" || id === "pro_yearly"

/** What the plan costs today, in rupees, GST included. */
export const priceOf = (id: PaidPlanId) => (LAUNCH_OFFER ? PLANS[id].launchPriceINR : PLANS[id].priceINR)

/** Emails a month the plan may send from PrettyBills. 0 = none. */
export const emailLimitOf = (id: PlanId) => (id === "free" ? PLANS.free.limits.manualEmailsPerMonth : PLANS[id].limits.emailsPerMonth)

export const hasFeature = (id: PlanId, feature: Feature) => PLANS[id].features[feature]

/** ₹1,199 */
export const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: n % 1 ? 2 : 0 })}`

/** The yearly plan spread over twelve months, rounded up: ₹1,199 → ₹100. */
export const yearlyPerMonth = () => Math.ceil(priceOf("pro_yearly") / 12)

/** Where every "this is a Pro feature" button leads. `from` is where to come back to. */
export function upgradeHref(feature: "email" = "email", from?: string) {
  const q = new URLSearchParams({ feature })
  if (from && from.startsWith("/") && !from.startsWith("//")) q.set("from", from)
  return `/pricing?${q}`
}

/** Whether one more invoice email may go out on this plan this month. */
export const canEmail = (plan: PlanSummary | null | undefined) => !!plan && plan.emails.limit > 0 && plan.emails.used < plan.emails.limit

/** Whether emailing is part of the plan at all (Pro, or a free allowance). False for guests. */
export const emailInPlan = (plan: PlanSummary | null | undefined) => !!plan && plan.emails.limit > 0
