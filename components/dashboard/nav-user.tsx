"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpRightIcon,
  BellIcon,
  Building2Icon,
  ChevronsUpDownIcon,
  CodeXmlIcon,
  CreditCardIcon,
  GiftIcon,
  KeyboardIcon,
  LanguagesIcon,
  LifeBuoyIcon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SparklesIcon,
  SunIcon,
  UserPlusIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react"

import { ProBadge } from "@/components/app/premium"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useTheme, type ThemeMode } from "@/hooks/use-theme"
import type { SessionUser } from "@/lib/auth/types"
import { authHref } from "@/lib/client/handoff"
import { useKeyLabels } from "@/lib/client/platform"
import { yearlyPerMonth } from "@/lib/pricing"

import { useDashboardUI } from "./dashboard-ui"
import { getQueryClient } from "@/lib/client/query"
import { setUserScope } from "@/lib/client/scope"

const item = "gap-2 py-1.5 text-[13px]"

const GUEST = { name: "Guest", email: "Log in to save your work", plan: "Free" }

/**
 * Profile button at the bottom of the sidebar and its account menu.
 * `user` is null for guests: same menu, with Log in / Sign up in place of Log out.
 */
export function NavUser({ user }: { user: SessionUser | null }) {
  const { isMobile } = useSidebar()
  const { mode, setMode } = useTheme()
  const router = useRouter()
  const [leaving, setLeaving] = React.useState(false)
  const ui = useDashboardUI()
  const keys = useKeyLabels()

  const shown = user ?? GUEST

  // whose data the browser cache holds; a different user here wipes it first
  React.useEffect(() => setUserScope(user?.id ?? "guest"), [user?.id])

  // signed out in another tab, or the session was revoked: leave the app here too
  React.useEffect(() => {
    if (!user) return
    // supabase-js loads after the page shows (it isn't needed to render)
    let unsubscribe = () => {}
    let cancelled = false
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (cancelled) return
      const { data } = createClient().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          // a full load: no cached page or query of this account survives into the next one
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full load: clears every cached page and query between accounts
          window.location.assign("/login")
        }
      })
      unsubscribe = () => data.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user])

  // guests: the invoice they're on comes along to the login page
  const toAuth = (mode: "login" | "signup") => router.push(authHref(mode))

  async function logOut() {
    setLeaving(true)
    const { createClient } = await import("@/lib/supabase/client")
    await createClient().auth.signOut()
    // drop every cached copy of this account's data, then a full load (clears Next's page cache too)
    getQueryClient().clear()
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full load: clears every cached page and query between accounts
    window.location.assign("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent">
                <UserAvatar user={user} />
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-[13px] font-semibold">{shown.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{shown.email}</span>
                </span>
                <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent className="w-(--anchor-width) min-w-64 rounded-xl p-1.5" side={isMobile ? "bottom" : "right"} align="end" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2.5 px-1.5 py-1.5 text-foreground">
                <UserAvatar user={user} />
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate text-[13px] font-semibold">{shown.name}</span>
                  <span className="truncate text-[11px] font-medium text-muted-foreground">{shown.email}</span>
                </span>
                {shown.plan === "Pro" ? <ProBadge /> : <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{shown.plan}</span>}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {!user && (
              <div className="mx-1 mt-1 mb-1.5 rounded-lg border border-brand/20 bg-brand/5 p-2.5">
                <p className="text-[12px] leading-snug text-foreground/80">You&apos;re a guest. Invoices aren&apos;t saved after you close this tab.</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <DropdownMenuItem
                    onClick={() => toAuth("signup")}
                    className="h-7 justify-center gap-1.5 rounded-md bg-linear-to-b from-brand to-brand-deep text-[12px] font-semibold text-white shadow-[0_2px_0_var(--brand-shadow)] focus:bg-none focus:text-white data-highlighted:from-brand data-highlighted:to-brand-deep data-highlighted:text-white [&_svg]:text-white"
                  >
                    <UserPlusIcon /> Sign up
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toAuth("login")} className="h-7 justify-center gap-1.5 rounded-md border bg-background text-[12px] font-semibold">
                    <LogInIcon /> Log in
                  </DropdownMenuItem>
                </div>
              </div>
            )}
            <DropdownMenuSeparator />

            {shown.plan !== "Pro" && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem className={item} onClick={() => router.push("/pricing")}>
                    <SparklesIcon className="text-amber-500" />
                    Upgrade to Pro
                    <Tag tone="brand">{`From ₹${yearlyPerMonth()}/mo`}</Tag>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuGroup>
              <DropdownMenuItem className={item} onClick={() => ui.openSettings("profile")}>
                <UserRoundIcon />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onClick={() => ui.openSettings("business")}>
                <Building2Icon />
                Business details
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onClick={() => router.push("/pricing")}>
                <CreditCardIcon />
                Billing & plan
                <Tag>{shown.plan}</Tag>
              </DropdownMenuItem>
              <DropdownMenuItem className={item} disabled>
                <UsersIcon />
                Team members
                <Tag>Soon</Tag>
              </DropdownMenuItem>
              <DropdownMenuItem className={item} disabled>
                <BellIcon />
                Notifications
                <Tag>Soon</Tag>
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onClick={() => ui.openSettings("preferences")}>
                <SettingsIcon />
                Settings
                <DropdownMenuShortcut>{keys.mod} ,</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={item}>
                  <ThemeIcon mode={mode} />
                  Theme
                  <span className="ml-auto text-[11px] text-muted-foreground capitalize">{mode}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-36 rounded-xl p-1.5">
                  <DropdownMenuRadioGroup value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
                    <DropdownMenuRadioItem value="light" className={item}>
                      <SunIcon /> Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark" className={item}>
                      <MoonIcon /> Dark
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system" className={item}>
                      <MonitorIcon /> System
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={item}>
                  <LanguagesIcon />
                  Language
                  <span className="ml-auto text-[11px] text-muted-foreground">English</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-36 rounded-xl p-1.5">
                  <DropdownMenuRadioGroup value="en">
                    <DropdownMenuRadioItem value="en" className={item}>
                      English
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="hi" className={item}>
                      हिन्दी
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="ur" className={item}>
                      اردو
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem className={item} onClick={ui.openShortcuts}>
                <KeyboardIcon />
                Keyboard shortcuts
                <DropdownMenuShortcut>?</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              {/* new tab, so a guest's unsaved invoice stays open here */}
              <DropdownMenuItem className={item} render={<a href="/help" target="_blank" rel="noopener" />}>
                <LifeBuoyIcon />
                Help & support
                <ArrowUpRightIcon className="ml-auto size-3.5! text-muted-foreground" />
              </DropdownMenuItem>
              <DropdownMenuItem className={item} render={<a href="/developers" target="_blank" rel="noopener" />}>
                <CodeXmlIcon />
                Developer docs
                <ArrowUpRightIcon className="ml-auto size-3.5! text-muted-foreground" />
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onClick={ui.openWhatsNew}>
                <GiftIcon />
                What&apos;s new
                {ui.whatsNewUnread && <span className="ml-auto size-1.5 rounded-full bg-brand" aria-label="New updates" />}
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onClick={() => ui.openFeedback()}>
                <MessageSquareIcon />
                Send feedback
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            {user ? (
              <DropdownMenuItem variant="destructive" className={item} disabled={leaving} closeOnClick={false} onClick={logOut}>
                {leaving ? <LoaderCircleIcon className="animate-spin" /> : <LogOutIcon />}
                {leaving ? "Logging out…" : "Log out"}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className={item} onClick={() => toAuth("login")}>
                <LogInIcon />
                Log in
                <Tag tone="brand">Saves your work</Tag>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UserAvatar({ user }: { user: SessionUser | null }) {
  if (!user) {
    return (
      <Avatar className="size-8 rounded-md">
        <AvatarFallback className="rounded-md border border-dashed border-foreground/25 bg-muted text-foreground/70">
          <UserRoundIcon className="size-4" />
        </AvatarFallback>
      </Avatar>
    )
  }
  return (
    <Avatar className="size-8 rounded-md">
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="rounded-md" />}
      <AvatarFallback className="rounded-md bg-linear-to-b from-brand to-brand-deep text-[11px] font-semibold text-white">{user.initials}</AvatarFallback>
    </Avatar>
  )
}

/** Same footprint as the profile button, shown while the session streams in. */
export function NavUserSkeleton() {
  return (
    <div className="flex h-12 items-center gap-2 px-2" aria-hidden>
      <Skeleton className="size-8 rounded-md" />
      <div className="grid flex-1 gap-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </div>
  )
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "brand" }) {
  return (
    <span className={tone === "brand" ? "ml-auto rounded bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand dark:bg-brand/20 dark:text-[#6da2ff]" : "ml-auto rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground"}>{children}</span>
  )
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "dark") return <MoonIcon />
  if (mode === "light") return <SunIcon />
  return <MonitorIcon />
}
