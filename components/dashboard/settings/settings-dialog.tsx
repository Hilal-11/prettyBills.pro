"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { BellIcon, Building2Icon, CreditCardIcon, KeyboardIcon, SlidersHorizontalIcon, UserRoundIcon, UsersIcon } from "lucide-react"
import { cn } from "cn"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ease, spring } from "@/lib/motion"

import type { SettingsTab } from "../dashboard-ui"
import { BusinessTab } from "./business-tab"
import { PreferencesTab } from "./preferences-tab"
import { ProfileTab } from "./profile-tab"
import { useAccount } from "./use-account"

type NavEntry = { id: SettingsTab; label: string; icon: typeof UserRoundIcon }

const ACCOUNT: NavEntry[] = [
  { id: "profile", label: "Profile", icon: UserRoundIcon },
  { id: "business", label: "Business details", icon: Building2Icon },
]
const APP: NavEntry[] = [{ id: "preferences", label: "Preferences", icon: SlidersHorizontalIcon }]

/** Not in the free first version; listed so people know they're coming. */
const LATER = [
  { label: "Billing & plan", icon: CreditCardIcon, tag: "Free" },
  { label: "Team members", icon: UsersIcon, tag: "Soon" },
  { label: "Notifications", icon: BellIcon, tag: "Soon" },
]

export function SettingsDialog({
  open,
  tab,
  onTabChange,
  onOpenChange,
  onOpenShortcuts,
  onOpenFeedback,
}: {
  open: boolean
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  onOpenChange: (open: boolean) => void
  onOpenShortcuts: () => void
  onOpenFeedback: (topic?: "account") => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(680px,92dvh)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[860px] sm:flex-row">
        {open && <Body tab={tab} onTabChange={onTabChange} onOpenShortcuts={onOpenShortcuts} onOpenFeedback={onOpenFeedback} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({ tab, onTabChange, onOpenShortcuts, onOpenFeedback }: { tab: SettingsTab; onTabChange: (tab: SettingsTab) => void; onOpenShortcuts: () => void; onOpenFeedback: (topic?: "account") => void }) {
  // loaded each time settings open, so it's never stale
  const { account, reload } = useAccount()

  return (
    <>
      <nav aria-label="Settings" className="shrink-0 border-b bg-sidebar p-2 sm:w-52 sm:border-r sm:border-b-0 sm:p-3">
        <div className="sr-only sm:not-sr-only sm:px-2 sm:pt-1 sm:pb-4">
          <DialogTitle className="text-[15px] font-semibold">Settings</DialogTitle>
        </div>
        <DialogDescription className="sr-only">Your profile, business details and preferences.</DialogDescription>
        <div className="flex gap-1 overflow-x-auto sm:grid sm:gap-0.5 sm:overflow-visible">
          <NavLabel>Account</NavLabel>
          {ACCOUNT.map((e) => (
            <NavButton key={e.id} entry={e} active={tab === e.id} onClick={() => onTabChange(e.id)} />
          ))}
          <NavLabel className="sm:mt-3">App</NavLabel>
          {APP.map((e) => (
            <NavButton key={e.id} entry={e} active={tab === e.id} onClick={() => onTabChange(e.id)} />
          ))}
          <button type="button" onClick={onOpenShortcuts} className={navCls}>
            <KeyboardIcon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">Keyboard shortcuts</span>
          </button>
          <div className="mt-3 hidden border-t border-dashed pt-3 sm:grid sm:gap-0.5">
            {LATER.map((l) => (
              <div key={l.label} className={cn(navCls, "cursor-default opacity-55 hover:text-muted-foreground")} aria-disabled>
                <l.icon className="size-4 shrink-0" />
                <span className="whitespace-nowrap">{l.label}</span>
                <span className="ml-auto rounded border bg-background/70 px-1 text-[10px]">{l.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/20 [scrollbar-gutter:stable]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease }} className="px-5 py-6 sm:px-8">
            {tab === "profile" && <ProfileTab account={account} reload={reload} onOpenFeedback={() => onOpenFeedback("account")} />}
            {tab === "business" && <BusinessTab account={account} />}
            {tab === "preferences" && <PreferencesTab account={account} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}

const navCls =
  "relative isolate flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"

function NavLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("hidden px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:block", className)}>{children}</p>
}

function NavButton({ entry, active, onClick }: { entry: NavEntry; active: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-current={active ? "page" : undefined} onClick={onClick} className={cn(navCls, active && "text-foreground")}>
      {active && <motion.span layoutId="settings-nav" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
      <entry.icon className="size-4 shrink-0" />
      <span className="whitespace-nowrap">{entry.label}</span>
    </button>
  )
}
