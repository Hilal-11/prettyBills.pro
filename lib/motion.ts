import type { Transition, Variants } from "motion/react"

/** Shared motion language for landing, dashboard and auth: one curve, one spring. */
export const ease = [0.2, 0, 0, 1] as const

export const spring: Transition = { type: "spring", bounce: 0.15, duration: 0.4 }

export const rise: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease } },
}

export const stagger: Variants = {
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
}
