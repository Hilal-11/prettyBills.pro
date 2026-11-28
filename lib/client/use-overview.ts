"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { EMPTY_OVERVIEW, type Overview } from "@/lib/data/types"
import { qk } from "@/lib/query-keys"

import { useUserScope } from "./scope"

async function fetchOverview(): Promise<Overview> {
  const res = await fetch("/api/invoices/overview")
  if (!res.ok) throw new Error(`overview ${res.status}`)
  const d = (await res.json()) as { overview?: Overview }
  return d.overview ?? EMPTY_OVERVIEW
}

/**
 * Invoice counts for the sidebar, from the browser's query cache: fresh for
 * 60 s (navigating doesn't refetch), refreshed quietly on tab focus and right
 * after any change (lib/client/sync). Keyed by the signed-in user; guests get
 * zeros and no request.
 */
export function useOverview() {
  const uid = useUserScope()
  const { data } = useQuery({
    queryKey: qk.overview(uid ?? "pending"),
    queryFn: fetchOverview,
    enabled: !!uid && uid !== "guest",
    placeholderData: keepPreviousData,
  })
  return uid === "guest" ? EMPTY_OVERVIEW : (data ?? EMPTY_OVERVIEW)
}
