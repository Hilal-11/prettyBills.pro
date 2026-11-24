"use client"

import * as React from "react"
import Link from "next/link"
import {
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
/* Intro video: full content width, scroll scale-in, foggy bottom      */
/* ------------------------------------------------------------------ */

export function HeroVideo({ src }: { src: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const reduce = useReducedMotion()

  // Respect "reduce motion": no autoplaying loop, show controls instead.
  React.useEffect(() => {
    if (reduce) videoRef.current?.pause()
  }, [reduce])

  // Grows from slightly smaller to full size as it scrolls into view. 2D only:
  // a 3D tilt breaks the masked backdrop blur of the fog in Chromium.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 25%"] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 })
  const scale = useTransform(progress, [0, 1], reduce ? [1, 1] : [0.92, 1])
  const y = useTransform(progress, [0, 1], reduce ? [0, 0] : [40, 0])

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.45, ease }}
      >
        <motion.div style={{ scale, y, transformOrigin: "50% 0%" }} className="relative">
          <div className="relative overflow-hidden rounded-2xl border bg-background/60 p-1.5 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.25)] ring-1 ring-black/[0.02] dark:shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] dark:ring-white/[0.03]">
            <video
              ref={videoRef}
              src={src}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              controls={!!reduce}
              aria-label="Prettybill product intro: making a GST invoice and sharing it"
              className="block aspect-[4/3] w-full rounded-xl bg-muted object-cover"
            />
          </div>

          {/* fog: progressive blur + fade into the page, covering the frame's bottom edge too */}
          <div aria-hidden className="pointer-events-none absolute -inset-x-6 -bottom-10 h-[calc(40%+2.5rem)]">
            <div className="absolute inset-0 backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black,transparent)]" />
            <div className="absolute inset-0 backdrop-blur-md [mask-image:linear-gradient(to_top,black_15%,transparent_75%)]" />
            <div className="absolute inset-0 bg-linear-to-t from-background via-background/75 to-transparent" />
          </div>
        </motion.div>
      </motion.div>
    </MotionConfig>
  )
}
