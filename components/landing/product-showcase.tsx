"use client"

import * as React from "react"
import Image from "next/image"
import { MotionConfig, motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react"
import { LockIcon } from "lucide-react"

const ease = [0.2, 0, 0, 1] as const

const SHOTS = [
  { src: "/landing/dashboard.webp", alt: "Dashboard with outstanding, overdue and collected totals, a collected vs invoiced chart and recent activity" },
  { src: "/landing/invoices.webp", alt: "Invoices table with draft, sent, overdue and paid tabs, totals and filters" },
  { src: "/landing/editor.webp", alt: "Invoice editor with a live A4 preview beside the form, GST totals and a UPI QR code" },
  { src: "/landing/client.webp", alt: "A client's page with billed, received and outstanding totals and a billed vs received chart" },
  { src: "/landing/settings.webp", alt: "Preferences with light, dark and system themes and eight interface fonts" },
  { src: "/landing/developers.webp", alt: "Developer docs for the invoices API with request and response examples" },
]

/** How long each screenshot stays. */
const SHOW_MS = 4000

/**
 * The hero's product window at full content width: app screenshots that
 * cross-fade on a timer (personal data blurred in public/landing). The top
 * 60% is sharp; below that it blurs progressively and the whole window,
 * border included, fades into the page. No shadow or glow. It pauses off
 * screen and in background tabs; with reduced motion it stays on the first.
 */
export function ProductShowcase() {
  const reduce = useReducedMotion()
  const frameRef = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState(0)
  const [onScreen, setOnScreen] = React.useState(true)

  React.useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  React.useEffect(() => {
    if (reduce || !onScreen) return
    const t = setInterval(() => document.visibilityState === "visible" && setActive((i) => (i + 1) % SHOTS.length), SHOW_MS)
    return () => clearInterval(t)
  }, [reduce, onScreen])

  // grows into place as it scrolls in (2D only, keeps text crisp)
  const { scrollYProgress } = useScroll({ target: frameRef, offset: ["start end", "start 30%"] })
  const eased = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 })
  const scale = useTransform(eased, [0, 1], reduce ? [1, 1] : [0.94, 1])

  return (
    <MotionConfig reducedMotion="user">
      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.45, ease }}>
        <motion.div ref={frameRef} style={{ scale, transformOrigin: "50% 0%" }} className="relative">
          <div className="relative overflow-hidden rounded-2xl border bg-background [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)]">
            {/* window bar */}
            <div className="flex h-10 items-center gap-3 border-b bg-muted/40 px-3.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
              </span>
              <div className="mx-auto flex h-6 w-full max-w-sm items-center justify-center gap-1.5 rounded-md border bg-background px-2 text-[11px] text-muted-foreground">
                <LockIcon className="size-3 shrink-0" aria-hidden />
                <span className="truncate">prettybills.app</span>
              </div>
              <span className="hidden w-[46px] sm:block" aria-hidden />
            </div>

            <div className="relative h-[260px] w-full overflow-hidden bg-muted/30 sm:h-[420px] lg:h-[560px]">
              {SHOTS.map((shot, i) => (
                <motion.div
                  key={shot.src}
                  aria-hidden={i !== active}
                  initial={false}
                  animate={i === active ? { opacity: 1, scale: 1, filter: "blur(0px)" } : { opacity: 0, scale: 1.015, filter: "blur(4px)" }}
                  transition={{ duration: 0.8, ease }}
                  className="absolute inset-0"
                >
                  <Image src={shot.src} alt={shot.alt} fill priority={i === 0} sizes="(min-width: 1288px) 1240px, 100vw" className="object-cover object-top" />
                </motion.div>
              ))}
            </div>

            {/* the bottom 40% blurs more the lower it goes; the frame's own mask fades it into the page */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%]">
              <div className="absolute inset-0 backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,transparent,black_35%)]" />
              <div className="absolute inset-0 backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,transparent_25%,black_65%)]" />
              <div className="absolute inset-0 backdrop-blur-[12px] [mask-image:linear-gradient(to_bottom,transparent_50%,black_90%)]" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </MotionConfig>
  )
}
