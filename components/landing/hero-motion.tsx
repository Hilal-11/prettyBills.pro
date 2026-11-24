"use client"

import * as React from "react"
import Link from "next/link"
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react"
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
            href="/templates"
            className="group inline-flex items-center gap-2 rounded-full border bg-background/60 py-1 pr-1 pl-3 text-xs text-muted-foreground shadow-xs backdrop-blur transition-colors hover:bg-muted/60 hover:text-foreground"
            {...trackAttrs("cta_templates_click", "hero_pill")}
          >
            Free GST invoice maker
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

        <motion.p variants={rise} className="mt-6 max-w-md text-[15px] leading-relaxed text-pretty text-muted-foreground">
          Make a GST-ready invoice in 30 seconds. Pick a template, add your items, share on WhatsApp, and get paid by UPI.
          Free forever, no signup needed.
        </motion.p>

        <motion.div variants={rise} className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </motion.div>

        <motion.p variants={rise} className="mt-5 text-xs text-muted-foreground">
          No signup · No invoice limit · No watermark
        </motion.p>
      </motion.div>
    </MotionConfig>
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-5 p-[5px]" aria-hidden>
      <path d="M3 8h9.5M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Showcase: app frame, template tabs, scroll tilt                     */
/* ------------------------------------------------------------------ */

export function HeroShowcase({
  templates,
  total,
}: {
  templates: { slug: string; name: string; node: React.ReactNode }[]
  total: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [active, setActive] = React.useState(templates[0].slug)
  const current = templates.find((t) => t.slug === active) ?? templates[0]

  // Tilted back while entering the viewport, flat by the time it's well in view.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 25%"] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 })
  const rotateX = useTransform(progress, [0, 1], reduce ? [0, 0] : [14, 0])
  const scale = useTransform(progress, [0, 1], reduce ? [1, 1] : [0.94, 1])

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.45, ease }}
        className="[perspective:1400px]"
      >
        <motion.div style={{ rotateX, scale, transformOrigin: "50% 0%" }} className="will-change-transform">
          <div className="rounded-2xl border bg-background/60 p-1.5 [mask-image:linear-gradient(to_bottom,black_62%,transparent)] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.25)] ring-1 ring-black/[0.02] backdrop-blur dark:shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] dark:ring-white/[0.03]">
            <div className="overflow-hidden rounded-xl border bg-muted/50 dark:bg-muted/30">
              {/* toolbar */}
              <div className="flex items-center gap-3 border-b bg-background/70 px-2 py-1.5 sm:px-3">
                <div className="hidden gap-1.5 pl-1 sm:flex" aria-hidden>
                  <span className="size-2.5 rounded-full bg-border" />
                  <span className="size-2.5 rounded-full bg-border" />
                  <span className="size-2.5 rounded-full bg-border" />
                </div>
                <div role="tablist" aria-label="Invoice template" className="-my-0.5 flex min-w-0 overflow-x-auto [scrollbar-width:none] sm:ml-2">
                  {templates.map((t) => {
                    const selected = t.slug === active
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setActive(t.slug)}
                        className={cn(
                          "relative isolate shrink-0 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {selected && (
                          <motion.span
                            layoutId="template-tab"
                            className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs"
                            transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
                          />
                        )}
                        {t.name}
                      </button>
                    )
                  })}
                </div>
                <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground md:inline-flex">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Paid · {total}
                </span>
              </div>

              {/* canvas */}
              <div className="relative h-[420px] overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] sm:h-[600px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={current.slug}
                    initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                    transition={{ duration: 0.45, ease }}
                    className="mx-auto mt-6 w-[88%] max-w-[600px] overflow-hidden rounded-md shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_20px_40px_-20px_rgb(0_0_0/0.3)] sm:mt-10"
                    role="tabpanel"
                    aria-label={`${current.name} template preview`}
                  >
                    {current.node}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </MotionConfig>
  )
}
