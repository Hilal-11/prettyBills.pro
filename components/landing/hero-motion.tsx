"use client"

import * as React from "react"
import Link from "next/link"
import { MotionConfig, motion, type Variants } from "motion/react"
import { cn } from "cn"

import { trackAttrs } from "@/lib/analytics"

const ease = [0.2, 0, 0, 1] as const

const rise: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } },
}

/* ------------------------------------------------------------------ */
/* Copy: staggered blur-in, headline word by word                      */
/* ------------------------------------------------------------------ */

export function HeroCopy({ actions }: { actions: React.ReactNode }) {
  const headline = [
    { text: "Pretty invoices.", muted: false },
    { text: "Paid faster.", muted: true },
  ]

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
        className="flex flex-col items-center text-center"
      >
        <motion.div variants={rise}>
          <Link
            href="/quotes"
            className="group inline-flex items-center gap-2 rounded-full border bg-background/60 py-1 pr-1 pl-3 text-xs text-muted-foreground shadow-xs backdrop-blur transition-colors hover:bg-muted/60 hover:text-foreground"
            {...trackAttrs("cta_create_click", "hero_pill_whats_new")}
          >
            <span className="rounded-full bg-brand/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-brand uppercase dark:bg-brand/20 dark:text-[#6da2ff]">New</span>
            Quotes, credit notes and TDS
            <span className="h-3.5 w-px bg-border" aria-hidden />
            <span className="relative grid size-5 place-items-center overflow-hidden rounded-full bg-muted text-foreground">
              <span className="flex w-10 -translate-x-5 transition-transform duration-300 ease-out group-hover:translate-x-0" aria-hidden>
                <Arrow />
                <Arrow />
              </span>
            </span>
          </Link>
        </motion.div>

        <h1 className="mt-7 max-w-3xl text-[2.6rem] leading-[1.05] font-medium tracking-[-0.04em] text-balance sm:text-6xl">
          {headline.map((line, li) => (
            <span key={line.text} className={cn("block", line.muted && "text-muted-foreground")}>
              {line.text.split(" ").map((word, wi) => (
                <motion.span key={`${li}-${wi}`} variants={rise} className="inline-block whitespace-pre">
                  {word}
                  {wi < line.text.split(" ").length - 1 ? " " : ""}
                </motion.span>
              ))}
            </span>
          ))}
        </h1>

        <motion.p variants={rise} className="mt-6 max-w-xl text-[15px] leading-relaxed text-pretty text-muted-foreground sm:text-base">
          Make a GST-ready invoice in 30 seconds, share it on WhatsApp and get paid by UPI. Then track every payment, receipt, quote and credit note in one place.
        </motion.p>

        <motion.div variants={rise} className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </motion.div>

        <motion.ul variants={rise} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground" aria-label="What you get free">
          {["No signup to start", "Unlimited invoices", "No watermark"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check />
              {t}
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </MotionConfig>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="8" className="fill-emerald-500/15" />
      <path d="M4.8 8.2l2.1 2.1 4.3-4.5" fill="none" className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-5 p-[5px]" aria-hidden>
      <path d="M3 8h9.5M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
