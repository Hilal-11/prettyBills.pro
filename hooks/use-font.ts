"use client"

import * as React from "react"

import { FONT_STORAGE_KEY, isUiFont, type UiFont } from "@/lib/theme"

const CHANGE = "pb:font"

function current(): UiFont {
  const f = document.documentElement.getAttribute("data-font")
  return isUiFont(f) ? f : "geist"
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(CHANGE, cb)
    window.removeEventListener("storage", cb)
  }
}

/** Applies a font to the page and remembers it on this device. */
export function applyFont(font: UiFont) {
  const el = document.documentElement
  if (font === "geist") el.removeAttribute("data-font")
  else el.setAttribute("data-font", font)
  try {
    if (font === "geist") localStorage.removeItem(FONT_STORAGE_KEY)
    else localStorage.setItem(FONT_STORAGE_KEY, font)
  } catch {}
  window.dispatchEvent(new Event(CHANGE))
}

/**
 * The interface font (Settings → Preferences). The <head> script in
 * lib/theme.ts sets it before first paint; this reads and changes it.
 */
export function useFont() {
  const font = React.useSyncExternalStore(subscribe, current, () => "geist" as UiFont)
  return { font, setFont: applyFont }
}
