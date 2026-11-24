"use client"

import * as React from "react"
import { ChevronRightIcon, ChevronsUpDownIcon, PlusIcon, SearchIcon, CheckIcon } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { navGroups, workspaces, type NavItem } from "@/lib/dashboard/data"

import { spring } from "@/lib/motion"
import { NavUser } from "./nav-user"

/**
 * Left sidebar. Navigation is UI-only for now: clicking an item moves the
 * active highlight (one shared pill that slides between items, same motion as
 * the landing page nav) but does not route anywhere yet.
 */
export function AppSidebar() {
  const [active, setActive] = React.useState("invoices-draft")

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-3">
        <WorkspaceSwitcher />
        <div className="flex gap-2 group-data-[collapsible=icon]:flex-col">
          <Button className="h-8 flex-1 justify-start gap-2 px-2.5 text-[13px] group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
            <PlusIcon />
            <span className="group-data-[collapsible=icon]:hidden">New invoice</span>
          </Button>
        </div>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border bg-background/60 px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground group-data-[collapsible=icon]:hidden"
        >
          <SearchIcon className="size-3.5" />
          Search
          <kbd className="ml-auto rounded border bg-muted px-1 font-sans text-[10px]">Ctrl K</kbd>
        </button>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {navGroups.map((group, gi) => (
          <SidebarGroup key={gi} className="py-1">
            {group.label && <SidebarGroupLabel className="text-[11px] tracking-wide uppercase">{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) =>
                item.children ? (
                  <CollapsibleNavItem key={item.id} item={item} active={active} onSelect={setActive} />
                ) : (
                  <NavLink key={item.id} item={item} active={active === item.id} onSelect={() => setActive(item.id)} />
                )
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <UpgradeCard />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
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

function NavLink({ item, active, onSelect }: { item: NavItem; active: boolean; onSelect: () => void }) {
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.label}
        isActive={active}
        onClick={onSelect}
        className={cn("relative isolate text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground data-active:bg-transparent data-active:text-foreground", item.soon && "opacity-70")}
      >
        {active && <ActivePill />}
        <Icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
      {item.soon ? (
        <SidebarMenuBadge className="rounded border bg-background/70 px-1 text-[10px] text-muted-foreground">Soon</SidebarMenuBadge>
      ) : item.count != null ? (
        <SidebarMenuBadge className="text-[11px] text-muted-foreground">{item.count}</SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  )
}

function CollapsibleNavItem({ item, active, onSelect }: { item: NavItem; active: string; onSelect: (id: string) => void }) {
  const Icon = item.icon
  const childActive = item.children?.some((c) => c.id === active)
  const { state, setOpen } = useSidebar()

  return (
    <Collapsible defaultOpen render={<SidebarMenuItem />} className="group/collapsible">
      <CollapsibleTrigger
        render={
          <SidebarMenuButton
            tooltip={item.label}
            onClick={() => state === "collapsed" && setOpen(true)}
            className={cn("text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground", childActive && "text-foreground")}
          />
        }
      >
        <Icon />
        <span>{item.label}</span>
        <ChevronRightIcon className="ml-auto size-3.5 transition-transform duration-200 group-data-open/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.2,0,0,1)] data-ending-style:h-0 data-starting-style:h-0">
        <SidebarMenuSub className="mr-0 pr-0">
          {item.children?.map((child) => {
            const isActive = child.id === active
            return (
              <SidebarMenuSubItem key={child.id}>
                <SidebarMenuSubButton
                  isActive={isActive}
                  onClick={() => onSelect(child.id)}
                  render={<button type="button" />}
                  className="relative isolate w-full cursor-pointer text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground data-active:bg-transparent data-active:text-foreground"
                >
                  {isActive && <ActivePill />}
                  <span>{child.label}</span>
                  {child.count != null && <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{child.count}</span>}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

function WorkspaceSwitcher() {
  const [current, setCurrent] = React.useState(workspaces[0])
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-xs font-semibold text-background">{current.initials}</span>
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-[13px] font-semibold">{current.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{current.meta}</span>
                </span>
                <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent className="w-(--anchor-width) min-w-60" align="start" sideOffset={6}>
            <DropdownMenuGroup>
            <DropdownMenuLabel>Businesses</DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => setCurrent(w)} className="gap-2 py-1.5">
                <span className="grid size-6 place-items-center rounded-md border text-[10px] font-semibold">{w.initials}</span>
                <span className="text-[13px]">{w.name}</span>
                {w.id === current.id && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 py-1.5 text-[13px] text-muted-foreground">
              <span className="grid size-6 place-items-center rounded-md border border-dashed">
                <PlusIcon className="size-3.5" />
              </span>
              Add business
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UpgradeCard() {
  return (
    <div className="rounded-lg border bg-background/70 p-3 group-data-[collapsible=icon]:hidden">
      <p className="text-[13px] font-semibold">Pro is coming</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Remove branding, add your team, e-invoicing and more.</p>
      <Button variant="outline" size="sm" className="mt-2.5 h-7 w-full text-xs">
        Join waitlist
      </Button>
    </div>
  )
}
