"use client"

import * as React from "react"

import { getQueryClient } from "./query"

/**
 * Whose data the browser cache holds: the signed-in user's id ("guest" when
 * signed out, null until known). Every query key starts with it. If it ever
 * changes to a different user in the same tab, everything cached is dropped
 * before the new user's data is fetched.
 */
let current: string | null = null
const listeners = new Set<() => void>()

export function setUserScope(id: string) {
  if (id === current) return
  if (current !== null) getQueryClient().clear()
  current = id
  for (const l of listeners) l()
}

export function useUserScope() {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => null
  )
}
