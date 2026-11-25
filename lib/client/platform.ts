"use client"

import * as React from "react"

const noop = () => () => {}

/** true on macOS / iOS. Server render and hydration assume Windows-style keys. */
export function useIsMac() {
  return React.useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => false
  )
}

/** Key labels for the current platform: "Ctrl" / "⌘", "Alt" / "⌥", "Shift" / "⇧". */
export function useKeyLabels() {
  const mac = useIsMac()
  return { mod: mac ? "⌘" : "Ctrl", alt: mac ? "⌥" : "Alt", shift: mac ? "⇧" : "Shift", mac }
}

/** true while the user is typing somewhere, so single-key shortcuts don't fire. */
export function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest("[role=combobox],[role=listbox],[role=textbox]")
}
