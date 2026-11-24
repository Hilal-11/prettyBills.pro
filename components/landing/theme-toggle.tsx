"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { THEME_STORAGE_KEY } from "@/lib/theme"

/** Light/dark switch. Icons spin-swap via CSS; the page cross-fades where View Transitions exist. */
export function ThemeToggle({ className }: { className?: string }) {
  function apply() {
    const root = document.documentElement
    const next = !root.classList.contains("dark")
    root.classList.toggle("dark", next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light")
    } catch {}
  }

  function toggle() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reduce && "startViewTransition" in document) document.startViewTransition(apply)
    else apply()
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle theme" className={cn("relative", className)}>
      <SunIcon className="scale-100 rotate-0 transition-transform duration-300 dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute scale-0 rotate-90 transition-transform duration-300 dark:scale-100 dark:rotate-0" />
    </Button>
  )
}
