"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowUpRightIcon, ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "cn"

import { Button, buttonVariants } from "@/components/ui/button"
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
import { useDashboardUI } from "@/components/dashboard/dashboard-ui"
import { useOverview } from "@/lib/client/use-overview"
import { EMPTY_OVERVIEW, type Overview } from "@/lib/data/types"
import { navGroups, type NavChild, type NavItem } from "@/lib/dashboard/data"
import { spring } from "@/lib/motion"

/** Is `href` the page we're on? Sub-pages count for top-level items (but /invoices only matches itself in the sub-list). */
const isOn = (pathname: string, href: string, exact = false) => pathname === href || (!exact && pathname.startsWith(`${href}/`))

/**
 * Left sidebar: the app's real pages, with the active one highlighted by a
 * pill that slides between items. `user` is the profile button slot,
 * streamed in by the server layout.
 */
export function AppSidebar({ user }: { user: React.ReactNode }) {
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
        <Link
          href="/invoices"
          onClick={done}
          className="flex h-8 items-center gap-2 rounded-md border bg-background/60 px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground group-data-[collapsible=icon]:hidden"
        >
          <SearchIcon className="size-3.5" />
          Search invoices
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* the current path is request data: the nav streams in with it, and the static shell shows it unhighlighted */}
        <React.Suspense fallback={<NavGroups pathname="" overview={EMPTY_OVERVIEW} onNavigate={done} />}>
          <LiveNav onNavigate={done} />
        </React.Suspense>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <UpgradeCard />
        {user}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
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
            <NavLink key={item.id} item={item} active={!!item.href && !item.external && isOn(pathname, item.href)} onNavigate={onNavigate} />
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

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon
  if (item.soon || !item.href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={`${item.label} (coming soon)`} aria-disabled className={cn(linkCls, "cursor-default opacity-60 hover:text-muted-foreground")}>
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
      </SidebarMenuButton>
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
  const total = overview.all

  return (
    <Collapsible defaultOpen render={<SidebarMenuItem />} className="group/collapsible">
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

/** Everything is free; this asks what people want next instead of selling. */
function UpgradeCard() {
  const ui = useDashboardUI()
  return (
    <div className="rounded-lg border bg-background/70 p-3 group-data-[collapsible=icon]:hidden">
      <p className="text-[13px] font-semibold">Free, and getting better</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Quotes, recurring invoices and online payments are next. What should we build first?</p>
      <Button variant="outline" size="sm" className="mt-2.5 h-7 w-full text-xs" onClick={() => ui.openFeedback("idea")}>
        Tell us
      </Button>
    </div>
  )
}
