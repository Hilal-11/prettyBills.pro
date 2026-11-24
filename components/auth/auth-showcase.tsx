"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"
import { cn } from "cn"

import { ease } from "@/lib/motion"

// Product facts, not testimonials: the content spec rules out quotes until they're real.
const slides = [
  {
    kicker: "GST done right",
    body: "CGST, SGST and IGST are picked automatically from the place of supply, with HSN/SAC search built in.",
    foot: "Every template, free forever",
  },
  {
    kicker: "UPI QR on every invoice",
    body: "Add your UPI ID once. Clients scan the code on the invoice and pay straight into your bank account.",
    foot: "No gateway fee on UPI QR",
  },
  {
    kicker: "Share on WhatsApp",
    body: "Send a link or PDF in one tap, then see when it's viewed, paid or overdue. Reminders go out for you.",
    foot: "Sent · Viewed · Paid · Overdue",
  },
]

/** Right-hand visual of the auth card: floating invoice + glass card with product facts. */
export function AuthShowcase({ invoice }: { invoice: React.ReactNode }) {
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const [direction, setDirection] = React.useState(1)
  const reduce = useReducedMotion()
  const slide = slides[index]

  const go = React.useCallback((step: number) => {
    setDirection(step)
    setIndex((i) => (i + step + slides.length) % slides.length)
  }, [])

  React.useEffect(() => {
    if (paused || reduce) return
    const t = setInterval(() => go(1), 6000)
    return () => clearInterval(t)
  }, [paused, reduce, go])

  return (
    <div
      className="relative isolate h-full min-h-[560px] overflow-hidden rounded-xl bg-linear-to-br from-[#06122f] via-[#0b2a8f] to-brand"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* grid + glows */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,black,transparent)]" />
      <div aria-hidden className="absolute -top-24 -right-16 -z-10 size-80 rounded-full bg-[#4d8dff]/40 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 -left-20 -z-10 size-96 rounded-full bg-[#0d41e1]/50 blur-3xl" />

      {/* floating invoice */}
      <motion.div
        initial={{ opacity: 0, y: 40, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -4 }}
        transition={{ duration: 1, delay: 0.2, ease }}
        className="absolute top-[7%] left-1/2 w-[70%] max-w-[400px] -translate-x-1/2"
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, -10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="overflow-hidden rounded-lg shadow-[0_40px_80px_-24px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.1)]"
        >
          {invoice}
        </motion.div>
      </motion.div>

      {/* glass card */}
      <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/15 bg-[#06122f]/60 p-5 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_20px_40px_-20px_rgb(0_0_0/0.6)] backdrop-blur-xl backdrop-saturate-150 sm:inset-x-5 sm:bottom-5">
        <div className="relative min-h-[118px]" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: direction * -24, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease }}
            >
              <p className="text-lg font-semibold tracking-[-0.01em]">{slide.kicker}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">{slide.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold">Prettybill</p>
            <p className="text-xs text-white/70">{slide.foot}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5" aria-hidden>
              {slides.map((_, i) => (
                <span key={i} className={cn("h-1 rounded-full bg-white transition-all duration-300", i === index ? "w-4 opacity-100" : "w-1 opacity-40")} />
              ))}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous"
                className="grid size-8 place-items-center rounded-full text-white/80 transition-[background-color,color,scale] hover:bg-white/15 hover:text-white active:scale-90"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next"
                className="grid size-8 place-items-center rounded-full text-white/80 transition-[background-color,color,scale] hover:bg-white/15 hover:text-white active:scale-90"
              >
                <ArrowRightIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
