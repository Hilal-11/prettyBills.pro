import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon, CrownIcon } from "lucide-react"
import { cn } from "cn"

import { Faq } from "@/components/docs/content"
import { Footer } from "@/components/landing/footer"
import { Navbar } from "@/components/landing/navbar"
import { ArrowNudge, CtaLink } from "@/components/landing/primitives"
import { CompareTable } from "@/components/pricing/compare"
import { ResumeCheckout } from "@/components/pricing/plan-cta"
import { PlanCards, PlanFacts } from "@/components/pricing/plans"
import { buttonVariants } from "@/components/ui/button"
import { emailLimitOf, inr, LAUNCH_OFFER, priceOf, yearlyPerMonth } from "@/lib/pricing"

export const metadata: Metadata = {
  title: "Pricing · PrettyBills",
  description: `Make, download and share GST invoices free, forever. Pro emails them to your clients from ${inr(priceOf("pro_monthly"))} a month.`,
}

/**
 * Pricing: Free, Pro monthly and Pro yearly. The page is static; each card's
 * button streams in once we know who's looking. ?feature=email&from=/path
 * (from the editor's Send button) adds a note and a way back to the invoice.
 */
export default function PricingPage({ searchParams }: PageProps<"/pricing">) {
  const limit = emailLimitOf("pro_monthly").toLocaleString("en-IN")
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="relative isolate overflow-hidden pt-28 pb-20 sm:pt-36">
          {/* faint grid and top light, like the cards are laid on paper */}
     

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              {LAUNCH_OFFER && (
                <a href="#plans" className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 py-1 pr-3 pl-1 text-xs text-foreground/80 backdrop-blur transition-colors hover:border-amber-400/60">
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">Launch offer</span>
                  Pro from {inr(yearlyPerMonth())} a month
                </a>
              )}
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">Free invoices. Pro sends them for you.</h1>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-muted-foreground sm:text-base">
                Making, downloading and sharing GST invoices is free, with no limits. Every email we send costs us money, so emailing invoices from PrettyBills is the one thing we charge for.
              </p>
            </div>

            <Suspense>
              <FromEditor searchParams={searchParams} />
            </Suspense>
            <Suspense>
              <ResumeCheckout searchParams={searchParams} />
            </Suspense>

            <div id="plans" className="mt-14 scroll-mt-28 sm:mt-16">
              <PlanCards />
              <PlanFacts />
            </div>
          </div>
        </section>

        <section aria-labelledby="compare" className="py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 id="compare" className="text-center text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
              Compare plans
            </h2>
            <p className="mt-2 text-center text-[15px] text-muted-foreground">Monthly and yearly Pro include the same things. Yearly just costs less.</p>
            <div className="mt-8">
              <CompareTable />
            </div>
          </div>
        </section>

        <section aria-labelledby="faq" className="border-t py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 id="faq" className="text-center text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
              Questions
            </h2>
            <div className="mt-8 grid gap-2.5">
              <Faq q="Is the Free plan really free?">Yes. No trial, no card, and no limit on invoices. Make them, download the PDF, share the link and send WhatsApp reminders as much as you like.</Faq>
              <Faq q="Why is emailing paid?">
                Every email PrettyBills sends goes through an email service we pay for each month. Pro covers that cost, which is what keeps everything else free for everyone.
              </Faq>
              <Faq q="Can I send invoices without Pro?">Yes. Download the PDF and attach it to an email yourself, copy the invoice link, or share it on WhatsApp. Your client gets the same invoice.</Faq>
              <Faq q={`What counts toward the ${limit} emails?`}>
                Each invoice you email counts once, however many people are on it. The count starts again on the 1st of every month. It&apos;s a fair-use limit that almost nobody reaches.
              </Faq>
              <Faq q="What's the difference between monthly and yearly?">
                Only how you pay. Yearly is {inr(priceOf("pro_yearly"))} once a year, about {inr(yearlyPerMonth())} a month, against {inr(priceOf("pro_monthly"))} paid monthly.
              </Faq>
              <Faq q="Can I cancel?">Any time. Pro stays on until the end of the period you&apos;ve paid for, then you&apos;re back on Free. Your invoices, clients and settings stay as they are.</Faq>
              <Faq q="Do prices include GST?">Yes. The price you see is the price you pay.</Faq>
              <Faq q="How do I pay?">By UPI, card or net banking, through Razorpay. We never see or store your card details.</Faq>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border bg-background px-6 py-12 text-center sm:px-12">
            <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_22%,transparent),transparent)] blur-2xl" />
            <h2 className="relative text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">Start free. Upgrade when you want it sent for you.</h2>
            <p className="relative mx-auto mt-3 max-w-md text-[15px] text-muted-foreground">Your first invoice takes about a minute, and you don&apos;t need an account to try it.</p>
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <CtaLink href="/create" event="cta_create_click" section="pricing" className="h-9 px-3.5 text-[13px]">
                Create free invoice
                <ArrowNudge />
              </CtaLink>
              <a href="#plans" className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-1.5 px-3.5 text-[13px]")}>
                <CrownIcon className="size-3.5 text-amber-500" /> See Pro plans
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

/** Shown when the editor's Send button brought someone here: why, and the way back. */
async function FromEditor({ searchParams }: { searchParams: PageProps<"/pricing">["searchParams"] }) {
  const sp = await searchParams
  if (sp.feature !== "email") return null
  const from = typeof sp.from === "string" && /^\/(create|invoices\/[\w-]{1,96})$/.test(sp.from) ? sp.from : null
  return (
    <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-4 rounded-xl border border-amber-400/40 bg-amber-400/[0.08] p-4 sm:flex-row sm:items-center sm:p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-400 text-amber-950">
        <CrownIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">Emailing invoices is part of Pro</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">Your invoice is kept. Upgrade below to email it, or go back and download the PDF or share the link for free.</p>
      </div>
      {from && (
        <Link href={from} className={cn(buttonVariants({ variant: "outline" }), "h-9 shrink-0 gap-1.5 px-3 text-[13px]")}>
          <ArrowLeftIcon className="size-3.5" /> Back to your invoice
        </Link>
      )}
    </div>
  )
}
