"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
import { cn } from "cn"

import { SupportButton } from "@/components/support-button"
import { Button, buttonVariants } from "@/components/ui/button"
import { trackAttrs } from "@/lib/analytics"
import { navLinks } from "@/lib/landing/content"

import { ArrowNudge, CtaLink, Logo } from "./primitives"
import { ThemeToggle } from "./theme-toggle"

const linkClass =
  "relative isolate rounded-md px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"

/**
 * Full-width bar at the top; once the page scrolls it tucks into a floating,
 * blurred pill. Nav links share one hover highlight that slides between them.
 */
export function Navbar() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = React.useState(false)
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24))

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3">
      <nav
        aria-label="Main"
        data-scrolled={scrolled || undefined}
        className={cn(
          "mx-auto mt-0 max-w-6xl rounded-none border border-transparent px-3 transition-[max-width,margin,background-color,border-color,border-radius,box-shadow] duration-500 ease-[cubic-bezier(0.2,0,0,1)] sm:px-4",
          "data-scrolled:mt-2 data-scrolled:max-w-4xl data-scrolled:rounded-xl data-scrolled:border-border data-scrolled:bg-background/70 data-scrolled:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] data-scrolled:backdrop-blur-lg",
          open && "rounded-xl border-border bg-background/95 backdrop-blur-lg"
        )}
      >
        <div className="flex h-12 items-center gap-2 sm:h-14">
          <Link href="/" aria-label="PrettyBills home" className="mr-3 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Logo />
          </Link>

          <ul className="hidden items-center md:flex" onMouseLeave={() => setHovered(null)}>
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className={linkClass} onMouseEnter={() => setHovered(link.label)}>
                  {hovered === link.label && (
                    <motion.span
                      layoutId="nav-hover"
                      className="absolute inset-0 -z-10 rounded-md bg-muted"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* 10px between what you see: icon, text, button edges. Ghost items cancel their own padding with negative margins. */}
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle className="-mx-1.5 hidden md:inline-flex" />
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mx-2 hidden px-2 text-[13px] md:inline-flex hover:bg-neutral-200/20 hover:underline dark:hover:bg-neutral-800")}
              {...trackAttrs("login_click", "navbar")}
            >
              Log in
            </Link>
            <CtaLink href="/create" event="cta_create_click" section="navbar" size="sm" className="text-[13px]">
              Create free invoice
              <ArrowNudge className="hidden sm:block" />
            </CtaLink>
            <SupportButton section="navbar" size="nav" className="hidden md:inline-flex" />
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((o) => !o)}
            >
              <MenuGlyph open={open} />
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
              className="overflow-hidden md:hidden"
            >
              <motion.ul
                className="flex flex-col gap-0.5 border-t py-3"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
              >
                {navLinks.map((link) => (
                  <motion.li key={link.label} variants={{ hidden: { opacity: 0, y: -4 }, show: { opacity: 1, y: 0 } }}>
                    <Link href={link.href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                      {link.label}
                    </Link>
                  </motion.li>
                ))}
                <motion.li variants={{ hidden: { opacity: 0, y: -4 }, show: { opacity: 1, y: 0 } }} className="mt-2 flex items-center justify-between gap-2 border-t pt-3">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}
                    {...trackAttrs("login_click", "navbar_mobile")}
                  >
                    Log in
                  </Link>
                  <ThemeToggle />
                </motion.li>
                <motion.li variants={{ hidden: { opacity: 0, y: -4 }, show: { opacity: 1, y: 0 } }} className="pt-2">
                  <SupportButton section="navbar_mobile" size="nav" className="w-full" />
                </motion.li>
              </motion.ul>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  )
}

/** Two bars that morph into an X. */
function MenuGlyph({ open }: { open: boolean }) {
  return (
    <span className="relative block size-4" aria-hidden>
      <span className={cn("absolute top-[5px] left-0.5 h-[1.5px] w-3 rounded-full bg-current transition-transform duration-300", open && "translate-y-[2.5px] rotate-45")} />
      <span className={cn("absolute top-[10px] left-0.5 h-[1.5px] w-3 rounded-full bg-current transition-transform duration-300", open && "-translate-y-[2.5px] -rotate-45")} />
    </span>
  )
}
