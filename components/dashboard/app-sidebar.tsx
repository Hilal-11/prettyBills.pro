"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowUpRightIcon, ChevronRightIcon, CrownIcon, KeyboardIcon, PaletteIcon, PlusIcon, SearchIcon, SettingsIcon } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { APP_NAME, BrandMark } from "@/components/brand"

import { useDashboardUI } from "./dashboard-ui"
import { Kbd } from "./shortcuts-dialog"
import { useKeyLabels } from "@/lib/client/platform"
import { useOverview } from "@/lib/client/use-overview"
import { EMPTY_OVERVIEW, type Overview } from "@/lib/data/types"
import { controlItems, navGroups, type NavChild, type NavItem } from "@/lib/dashboard/data"
import { spring } from "@/lib/motion"

/** Is `href` the page we're on? Sub-pages count for top-level items; `exact` for sub-lists. */
const isOn = (pathname: string, href: string, exact = false) => pathname === href || (!exact && pathname.startsWith(`${href}/`))

/**
 * Left sidebar: the app's real pages, with the active one highlighted by a
 * pill that slides between items. `user` is the profile button slot and
 * `upgrade` the plan card above it, both streamed in by the server layout.
 */
export function AppSidebar({ user, upgrade }: { user: React.ReactNode; upgrade?: React.ReactNode }) {
  const router = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()
  // on phones the sidebar is a sheet: close it once a page is chosen
  const done = React.useCallback(() => isMobile && setOpenMobile(false), [isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-3">
        <BrandHeader />
        <Link
          href="/create"
          onClick={(e) => {
            // already on a new invoice: start another fresh one
            if (window.location.pathname === "/create") {
              e.preventDefault()
              router.push(`/create?n=${Date.now().toString(36)}`)
            }
            done()
          }}
          className={cn(
            buttonVariants(),
            "h-8 justify-start gap-2 px-2.5 text-[13px] group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
          )}
        >
          <PlusIcon />
          <span className="group-data-[collapsible=icon]:hidden">New invoice</span>
        </Link>
        <SearchButton onOpen={done} />
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* the current path is request data: the nav streams in with it, and the static shell shows it unhighlighted */}
        <React.Suspense fallback={<NavGroups pathname="" overview={EMPTY_OVERVIEW} onNavigate={done} />}>
          <LiveNav onNavigate={done} />
        </React.Suspense>
        <AppControls onNavigate={done} />
      </SidebarContent>

      <SidebarFooter className="gap-2">
        {upgrade}
        {user}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

/**
 * Pinned to the bottom of the nav: Team members, Notifications, Languages,
 * Keyboard shortcuts and Developer docs (flags from config/features.ts), then
 * Themes and Settings. Themes opens Settings → Preferences (light / dark /
 * system and the interface font); Settings opens the dialog, like Ctrl/⌘ ,.
 */
function AppControls({ onNavigate }: { onNavigate: () => void }) {
  const { openSettings, openShortcuts } = useDashboardUI()
  const { mod } = useKeyLabels()
  const open = (tab: "preferences" | "profile") => () => {
    onNavigate()
    openSettings(tab)
  }
  const docs = controlItems.filter((i) => i.id === "api-docs")
  return (
    <SidebarGroup className="mt-auto py-1">
      <SidebarMenu>
        {controlItems
          .filter((i) => i.id !== "api-docs")
          .map((item) => (
            <NavLink key={item.id} item={item} active={false} onNavigate={onNavigate} />
          ))}
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Keyboard shortcuts"
            className={linkCls}
            onClick={() => {
              onNavigate()
              openShortcuts()
            }}
          >
            <KeyboardIcon />
            <span>Keyboard shortcuts</span>
            <span className="ml-auto flex items-center gap-0.5 group-data-[collapsible=icon]:hidden">
              <Kbd className="h-4.5 min-w-4.5 px-1 text-[10px]">?</Kbd>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {docs.map((item) => (
          <NavLink key={item.id} item={item} active={false} onNavigate={onNavigate} />
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Themes" className={linkCls} onClick={open("preferences")}>
            <PaletteIcon />
            <span>Themes</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Settings" className={linkCls} onClick={open("profile")}>
            <SettingsIcon />
            <span>Settings</span>
            <span className="ml-auto flex items-center gap-0.5 group-data-[collapsible=icon]:hidden">
              <Kbd className="h-4.5 min-w-4.5 px-1 text-[10px]">{mod}</Kbd>
              <Kbd className="h-4.5 min-w-4.5 px-1 text-[10px]">,</Kbd>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}

/** Opens the ⌘K palette: invoices, clients, receipts, pages and actions. */
function SearchButton({ onOpen }: { onOpen: () => void }) {
  const { openSearch } = useDashboardUI()
  const { mod } = useKeyLabels()
  return (
    <button
      type="button"
      onClick={() => {
        onOpen()
        openSearch()
      }}
      aria-keyshortcuts="Control+K Meta+K"
      className="flex h-8 items-center gap-2 rounded-md border bg-background/60 px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground group-data-[collapsible=icon]:hidden"
    >
      <SearchIcon className="size-3.5" />
      Search
      <span className="ml-auto flex items-center gap-0.5">
        <Kbd className="h-4.5 min-w-4.5 px-1 text-[10px]">{mod}</Kbd>
        <Kbd className="h-4.5 min-w-4.5 px-1 text-[10px]">K</Kbd>
      </span>
    </button>
  )
}

function LiveNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname()
  const overview = useOverview()
  return <NavGroups pathname={pathname} overview={overview} onNavigate={onNavigate} />
}

function NavGroups({ pathname, overview, onNavigate }: { pathname: string; overview: Overview; onNavigate: () => void }) {
  return navGroups.map((group, gi) => (
    <SidebarGroup key={gi} className="py-1">
      {group.label && <SidebarGroupLabel className="text-[11px] tracking-wide uppercase">{group.label}</SidebarGroupLabel>}
      <SidebarMenu>
        {group.items.map((item) =>
          item.children ? (
            <CollapsibleNavItem key={item.id} item={item} pathname={pathname} overview={overview} onNavigate={onNavigate} />
          ) : (
            <NavLink key={item.id} item={item} count={item.count ? overview[item.count] : 0} active={!!item.href && !item.external && isOn(pathname, item.href)} onNavigate={onNavigate} />
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  ))
}

/** The pill behind the active item. One layoutId, so it glides between items. */
function ActivePill({ className }: { className?: string }) {
  return (
    <motion.span
      layoutId="sidebar-active"
      transition={spring}
      className={cn("absolute inset-0 -z-10 rounded-md border bg-background shadow-xs", className)}
    />
  )
}

const linkCls = "relative isolate text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground data-active:bg-transparent data-active:text-foreground"

function NavLink({ item, count, active, onNavigate }: { item: NavItem; count?: number | null; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon
  if (item.soon || !item.href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          // the one-line description, shown whether the sidebar is open or collapsed
          tooltip={{
            hidden: false,
            className: "max-w-60",
            children: (
              <span className="grid gap-0.5">
                <span className="font-medium">{item.label} · coming soon</span>
                {item.description && <span className="opacity-80">{item.description}</span>}
              </span>
            ),
          }}
          aria-disabled
          className={cn(linkCls, "cursor-default opacity-60 hover:text-muted-foreground aria-disabled:pointer-events-auto")}
        >
          <Icon />
          <span>{item.label}</span>
        </SidebarMenuButton>
        <SidebarMenuBadge className="rounded border bg-background/70 px-1 text-[10px] text-muted-foreground">Soon</SidebarMenuBadge>
      </SidebarMenuItem>
    )
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.label}
        isActive={active}
        className={linkCls}
        render={item.external ? <a href={item.href} target="_blank" rel="noopener" /> : <Link href={item.href} onClick={onNavigate} />}
      >
        {active && <ActivePill />}
        <Icon />
        <span>{item.label}</span>
        {item.external && <ArrowUpRightIcon className="ml-auto size-3.5! opacity-60" />}
        {item.pro && <CrownIcon aria-label="Pro" className="ml-auto size-3.5! text-amber-500 group-data-[collapsible=icon]:hidden" />}
      </SidebarMenuButton>
      {!!count && (
        <SidebarMenuBadge
          aria-label={item.tone === "danger" ? `${count} overdue` : String(count)}
          className={cn("text-[11px] tabular-nums", item.tone === "danger" ? "rounded bg-red-500/10 px-1 font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}
        >
          {count}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  )
}

function Count({ child, overview, active }: { child: NavChild; overview: Overview; active: boolean }) {
  const n = child.count ? overview[child.count] : 0
  if (!n) return null
  return (
    <span className={cn("ml-auto text-[11px] tabular-nums", child.tone === "danger" ? "rounded bg-red-500/10 px-1 font-medium text-red-600 dark:text-red-400" : active ? "text-foreground/70" : "text-muted-foreground")}>
      {n}
    </span>
  )
}

function CollapsibleNavItem({ item, pathname, overview, onNavigate }: { item: NavItem; pathname: string; overview: Overview; onNavigate: () => void }) {
  const Icon = item.icon
  const inside = !!item.href && isOn(pathname, item.href)
  const { state, setOpen } = useSidebar()
  const total = item.count ? (overview[item.count] ?? 0) : 0

  return (
    <Collapsible defaultOpen={item.defaultOpen !== false || inside} render={<SidebarMenuItem />} className="group/collapsible">
      <CollapsibleTrigger
        render={
          <SidebarMenuButton
            tooltip={item.label}
            onClick={() => state === "collapsed" && setOpen(true)}
            className={cn("text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground", inside && "text-foreground")}
          />
        }
      >
        <Icon />
        <span>{item.label}</span>
        {total > 0 && <span className="ml-auto text-[11px] text-muted-foreground tabular-nums group-data-open/collapsible:hidden">{total}</span>}
        <ChevronRightIcon className="ml-auto size-3.5 transition-transform duration-200 group-data-open/collapsible:ml-0 group-data-open/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.2,0,0,1)] data-ending-style:h-0 data-starting-style:h-0">
        <SidebarMenuSub className="mr-0 pr-0">
          {item.children?.map((child) => {
            const isActive = isOn(pathname, child.href, true)
            return (
              <SidebarMenuSubItem key={child.id}>
                <SidebarMenuSubButton isActive={isActive} render={<Link href={child.href} onClick={onNavigate} />} className="relative isolate w-full cursor-pointer text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground data-active:bg-transparent data-active:text-foreground">
                  {isActive && <ActivePill />}
                  <span>{child.label}</span>
                  <Count child={child} overview={overview} active={isActive} />
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Brand at the top of the sidebar: the app icon and name, linking home. */
function BrandHeader() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip="PrettyBills home" render={<Link href="/" />} className="gap-2.5 hover:bg-sidebar-accent/60">
          <BrandMark size={32} className="group-data-[collapsible=icon]:-ml-0.5" />
          <span className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate text-[15px] font-semibold tracking-[-0.02em]">{APP_NAME}</span>
            <span className="truncate text-[11px] text-muted-foreground">Free GST invoices</span>
          </span>
          <span className="ml-auto rounded border bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">Beta</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

