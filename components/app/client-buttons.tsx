"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"
import { cn } from "cn"

import { useDashboardUI, type SettingsTab } from "@/components/dashboard/dashboard-ui"
import { Button } from "@/components/ui/button"

/** Re-reads the page's data from the server without a full reload. */
export function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  return (
    <Button variant="outline" className="h-8 gap-1.5 px-3 text-[13px]" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      <RefreshCwIcon className={cn(pending && "animate-spin")} /> <span className="hidden sm:inline">Refresh</span>
    </Button>
  )
}

/** Opens the Settings dialog at a tab, from server-rendered pages. */
export function OpenSettings({ tab, children, className }: { tab: SettingsTab; children: React.ReactNode; className?: string }) {
  const ui = useDashboardUI()
  return (
    <button type="button" onClick={() => ui.openSettings(tab)} className={className}>
      {children}
    </button>
  )
}
