"use client"

import * as React from "react"

import { THEME_STORAGE_KEY } from "@/lib/theme"

export type ThemeMode = "light" | "dark" | "system"

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyMode(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && systemPrefersDark())
  document.documentElement.classList.toggle("dark", dark)
  try {
    if (mode === "system") localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {}
}

/**
 * Light / dark / system theme, shared by the landing toggle and the dashboard.
 * Changes cross-fade with View Transitions unless the user prefers reduced motion.
 */
export function useTheme() {
  const [mode, setModeState] = React.useState<ThemeMode>("system")

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from storage after hydration
      if (saved === "light" || saved === "dark") setModeState(saved)
    } catch {}
  }, [])

  const setMode = React.useCallback((next: ThemeMode) => {
    setModeState(next)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reduce && "startViewTransition" in document) document.startViewTransition(() => applyMode(next))
    else applyMode(next)
  }, [])

  const toggle = React.useCallback(() => {
    setMode(document.documentElement.classList.contains("dark") ? "light" : "dark")
  }, [setMode])

  return { mode, setMode, toggle }
}
