import { Suspense } from "react"
import { CircleCheckIcon, CrownIcon } from "lucide-react"
import { cn } from "cn"

import { COSTS, LAUNCH_OFFER, PLANS, inr, priceOf, yearlyPerMonth, type PlanId } from "@/lib/pricing"

import { FREE_LINES, PRO_LINES, type PlanLine } from "./content"
import { PlanCta, PlanCtaSkeleton } from "./plan-cta"

type Card = {
  id: PlanId
  name: string
  tagline: string
  price: string
  per: string
  was?: string
  sub?: string
  lead: string
  lines: PlanLine[]
  note?: string
  badge?: string
  featured?: boolean
}

const CARDS: Card[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Everything you need to make and share GST invoices",
    price: "Free",
    per: "/ forever",
    sub: "No card, no trial, no invoice limit",
    lead: "Included, free forever:",
    lines: FREE_LINES,
    note: "Emailing from PrettyBills isn't included. Send the PDF or the link yourself, free.",
  },
  {
    id: "pro_monthly",
    name: "Pro · Monthly",
    tagline: "Email invoices straight from PrettyBills",
    price: inr(priceOf("pro_monthly")),
    per: "/ month",
    was: LAUNCH_OFFER ? inr(PLANS.pro_monthly.priceINR) : undefined,
    sub: "Billed monthly. Cancel any time.",
    lead: "Everything in Free, plus",
    lines: PRO_LINES,
  },
  {
    id: "pro_yearly",
    name: "Pro · Yearly",
    tagline: `All of Pro for about ${inr(yearlyPerMonth())} a month`,
    price: inr(priceOf("pro_yearly")),
    per: "/ year",
    was: LAUNCH_OFFER ? inr(PLANS.pro_yearly.priceINR) : undefined,
    sub: `Billed yearly. ${PLANS.pro_yearly.savingsLabel} on monthly.`,
    lead: "Everything in Free, plus",
    lines: PRO_LINES,
    badge: "Best value",
    featured: true,
  },
]

/** The three plan cards. The featured one is lifted, lit, and wears the badge. */
export function PlanCards() {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-3 md:gap-5">
      {CARDS.map((card) => (
        <PlanCard key={card.id} card={card} />
      ))}
    </div>
  )
}

function PlanCard({ card }: { card: Card }) {
  const pro = card.id !== "free"
  return (
    <section
      aria-labelledby={`plan-${card.id}`}
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 sm:p-7",
        card.featured
          ? "z-10 bg-background shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_30px_70px_-30px_rgb(13_65_225/0.35),0_12px_30px_-18px_rgb(0_0_0/0.2)] md:-my-4 md:py-10"
          : "bg-muted/40 dark:bg-muted/20"
      )}
    >
      {card.featured && (
        <>
          {/* soft light in the corner, with a fine dot texture */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute -top-24 -right-20 size-72 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_32%,transparent),transparent)] blur-xl" />
            <div className="absolute -top-10 right-24 size-48 rounded-full bg-[radial-gradient(closest-side,rgb(167_139_250/0.35),transparent)] blur-xl" />
            <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(rgb(255_255_255/0.9)_1px,transparent_1.2px)] [background-size:9px_9px] opacity-40 [mask-image:radial-gradient(70%_100%_at_85%_0%,black,transparent)] dark:opacity-15" />
          </div>
          <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 -rotate-3 items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background shadow-lg">
            <CrownIcon className="size-3.5 text-amber-400" /> {card.badge}
          </span>
        </>
      )}

      <div className="relative flex flex-1 flex-col">
        <h3 id={`plan-${card.id}`} className="text-[19px] font-semibold tracking-[-0.02em]">
          {card.name}
        </h3>
        <p className="mt-1 min-h-10 text-[13.5px] leading-snug text-muted-foreground">{card.tagline}</p>

        <div className="mt-6 flex items-baseline gap-1.5">
          <span className="text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{card.price}</span>
          <span className="text-sm text-muted-foreground">{card.per}</span>
          {card.was && (
            <span className="ml-1 text-sm text-muted-foreground line-through decoration-foreground/40" aria-label={`Regular price ${card.was}`}>
              {card.was}
            </span>
          )}
        </div>
        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {card.was && <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-1.5 py-px font-medium text-amber-700 dark:text-amber-300">Launch price</span>}
          {card.sub}
        </div>

        <div className="my-6 h-px bg-border" />

        <p className="text-[13px] font-medium text-foreground/80">
          {card.lead}
          {pro && <span className="ml-1 font-semibold text-brand dark:text-[#6da2ff]">+</span>}
        </p>
        <ul className="mt-3 grid gap-2.5 text-[13.5px]">
          {card.lines.map((line) => (
            <li key={line.label} className={cn("flex items-start gap-2.5", line.soon && "text-muted-foreground")}>
              <CircleCheckIcon className={cn("mt-px size-4 shrink-0", line.soon ? "text-muted-foreground/60" : pro ? "text-brand dark:text-[#6da2ff]" : "text-foreground/55")} />
              <span className="leading-snug">
                {line.label}
                {line.soon && <span className="ml-1.5 rounded border px-1 py-px align-[1px] text-[10px] font-medium">Soon</span>}
              </span>
            </li>
          ))}
        </ul>
        {card.note && <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground italic">{card.note}</p>}

        <div className="mt-auto pt-8">
          <Suspense fallback={<PlanCtaSkeleton />}>
            <PlanCta plan={card.id} primary={card.featured} />
          </Suspense>
        </div>
      </div>
    </section>
  )
}

/** The small print under the cards. */
export function PlanFacts() {
  const facts = [COSTS.pricesIncludeGST ? "Prices include GST" : "Prices exclude GST", "Cancel any time", "Pay by UPI, card or net banking", "Your invoices stay yours, on any plan"]
  return (
    <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
      {facts.map((f) => (
        <li key={f} className="flex items-center gap-1.5">
          <CircleCheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" /> {f}
        </li>
      ))}
    </ul>
  )
}
