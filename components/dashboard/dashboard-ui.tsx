"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { latestChangelogId } from "@/lib/dashboard/changelog"
import { isTyping } from "@/lib/client/platform"
import type { FeedbackTopic } from "@/lib/feedback"

export type SettingsTab = "profile" | "business" | "preferences"

type Panel = { kind: "settings"; tab: SettingsTab } | { kind: "shortcuts" } | { kind: "whats-new" } | { kind: "feedback"; topic?: FeedbackTopic } | { kind: "search" } | null

type DashboardUI = {
  openSettings: (tab?: SettingsTab) => void
  openShortcuts: () => void
  openWhatsNew: () => void
  openFeedback: (topic?: FeedbackTopic) => void
  /** The ⌘K search palette. */
  openSearch: () => void
  /** true until the newest "What's new" entry has been opened on this device. */
  whatsNewUnread: boolean
}

const Ctx = React.createContext<DashboardUI | null>(null)

export function useDashboardUI() {
  const ui = React.useContext(Ctx)
  if (!ui) throw new Error("useDashboardUI must be used inside <DashboardUIProvider>")
  return ui
}

// Dialogs load on first open, not with every page (they're a large share of the app's JS).
const SettingsDialog = dynamic(() => import("./settings/settings-dialog").then((m) => m.SettingsDialog), { ssr: false })
const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), { ssr: false })
const FeedbackDialog = dynamic(() => import("./feedback").then((m) => m.FeedbackDialog), { ssr: false })
const ShortcutsDialog = dynamic(() => import("./shortcuts-dialog").then((m) => m.ShortcutsDialog), { ssr: false })
const WhatsNewDialog = dynamic(() => import("./whats-new-dialog").then((m) => m.WhatsNewDialog), { ssr: false })

/* the unread dot: localStorage, shared by every tab */
const SEEN_KEY = "pb.whatsNewSeen"
const SEEN_EVENT = "pb:whats-new-seen"
const subscribeSeen = (cb: () => void) => {
  window.addEventListener(SEEN_EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(SEEN_EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return latestChangelogId
  }
}

/**
 * Account menu destinations for the dashboard: settings, shortcuts, what's new
 * and feedback. They open as dialogs over the editor (never a page change), so
 * a guest's unsaved invoice is never lost by opening one.
 */
export function DashboardUIProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanel] = React.useState<Panel>(null)
  // remembers the last settings tab so the dialog can animate closed with its content intact
  const [settingsTab, setSettingsTab] = React.useState<SettingsTab>("profile")
  const seen = React.useSyncExternalStore(subscribeSeen, readSeen, () => latestChangelogId)

  const ui = React.useMemo<DashboardUI>(
    () => ({
      openSettings: (tab = "profile") => {
        setSettingsTab(tab)
        setPanel({ kind: "settings", tab })
      },
      openShortcuts: () => setPanel({ kind: "shortcuts" }),
      openWhatsNew: () => {
        try {
          localStorage.setItem(SEEN_KEY, latestChangelogId)
        } catch {}
        window.dispatchEvent(new Event(SEEN_EVENT))
        setPanel({ kind: "whats-new" })
      },
      openFeedback: (topic) => setPanel({ kind: "feedback", topic }),
      openSearch: () => setPanel({ kind: "search" }),
      whatsNewUnread: seen !== latestChangelogId,
    }),
    [seen],
  )

  // ? → shortcuts, Ctrl/⌘ , → settings, Ctrl/⌘ / → shortcuts, Ctrl/⌘ K → search
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPanel((p) => (p?.kind === "search" ? null : { kind: "search" }))
      } else if (mod && e.key === ",") {
        e.preventDefault()
        ui.openSettings("preferences")
      } else if (mod && e.key === "/") {
        e.preventDefault()
        setPanel((p) => (p?.kind === "shortcuts" ? null : { kind: "shortcuts" }))
      } else if (e.key === "?" && !mod && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        setPanel((p) => (p?.kind === "shortcuts" ? null : { kind: "shortcuts" }))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [ui])

  // each dialog mounts the first time it opens (its code downloads then), and stays for the close animation
  const [opened, setOpened] = React.useState<ReadonlySet<string>>(() => new Set())
  if (panel && !opened.has(panel.kind)) setOpened(new Set(opened).add(panel.kind))
  const has = (kind: NonNullable<Panel>["kind"]) => opened.has(kind) || panel?.kind === kind

  // ⌘K should feel instant: fetch the palette's code once the page is idle
  React.useEffect(() => {
    const warm = () => void import("./command-palette")
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number
    }
    if (w.requestIdleCallback) w.requestIdleCallback(warm)
    else setTimeout(warm, 2000)
  }, [])

  const close = React.useCallback(() => setPanel(null), [])
  const onOpenChange = (open: boolean) => !open && close()

  return (
    <Ctx.Provider value={ui}>
      {children}
      {has("settings") && (
        <SettingsDialog
          open={panel?.kind === "settings"}
          tab={panel?.kind === "settings" ? panel.tab : settingsTab}
          onTabChange={(tab) => setPanel({ kind: "settings", tab })}
          onOpenChange={onOpenChange}
          onOpenShortcuts={ui.openShortcuts}
          onOpenFeedback={ui.openFeedback}
        />
      )}
      {has("shortcuts") && <ShortcutsDialog open={panel?.kind === "shortcuts"} onOpenChange={onOpenChange} />}
      {has("search") && <CommandPalette open={panel?.kind === "search"} onOpenChange={onOpenChange} openSettings={ui.openSettings} openShortcuts={ui.openShortcuts} openWhatsNew={ui.openWhatsNew} openFeedback={() => ui.openFeedback()} />}
      {has("whats-new") && <WhatsNewDialog open={panel?.kind === "whats-new"} onOpenChange={onOpenChange} onOpenFeedback={() => ui.openFeedback()} />}
      {has("feedback") && <FeedbackDialog open={panel?.kind === "feedback"} topic={panel?.kind === "feedback" ? panel.topic : undefined} onOpenChange={onOpenChange} />}
    </Ctx.Provider>
  )
}
