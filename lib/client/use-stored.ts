"use client"

import * as React from "react"

import { writeLocal } from "./local"

const EVENT = "pb:stored"

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(EVENT, cb)
  }
}

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * A small preference kept in localStorage (column choices, density). The
 * server render and first paint use `fallback`, then the stored value, so
 * there's no hydration mismatch. Other tabs pick up changes too.
 * `fallback` must be stable (a module-level constant).
 */
export function useStored<T>(key: string, fallback: T): [T, (value: T) => void] {
  const raw = React.useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  )
  const value = React.useMemo(() => {
    if (!raw) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }, [raw, fallback])
  const set = React.useCallback(
    (next: T) => {
      writeLocal(key, next)
      window.dispatchEvent(new Event(EVENT))
    },
    [key]
  )
  return [value, set]
}
