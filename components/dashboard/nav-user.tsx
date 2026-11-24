"use client"

import {
  BellIcon,
  Building2Icon,
  ChevronsUpDownIcon,
  CreditCardIcon,
  GiftIcon,
  KeyboardIcon,
  LanguagesIcon,
  LifeBuoyIcon,
  LogOutIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SparklesIcon,
  SunIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { useTheme, type ThemeMode } from "@/hooks/use-theme"
import { currentUser } from "@/lib/dashboard/data"

const item = "gap-2 py-1.5 text-[13px]"

/** Profile button at the bottom of the sidebar and its account menu. */
export function NavUser() {
  const { isMobile } = useSidebar()
  const { mode, setMode } = useTheme()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent">
                <UserAvatar />
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-[13px] font-semibold">{currentUser.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{currentUser.email}</span>
                </span>
                <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-64 rounded-xl p-1.5"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-2.5 px-1.5 py-1.5 text-foreground">
              <UserAvatar />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-[13px] font-semibold">{currentUser.name}</span>
                <span className="truncate text-[11px] font-medium text-muted-foreground">{currentUser.email}</span>
              </span>
              <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{currentUser.plan}</span>
            </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem className={item}>
                <SparklesIcon />
                Upgrade to Pro
                <span className="ml-auto rounded bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand dark:bg-brand/20 dark:text-[#6da2ff]">Soon</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem className={item}>
                <UserRoundIcon />
                Profile
                <DropdownMenuShortcut>Ctrl P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem className={item}>
                <Building2Icon />
                Business details
              </DropdownMenuItem>
              <DropdownMenuItem className={item}>
                <CreditCardIcon />
                Billing & plan
              </DropdownMenuItem>
              <DropdownMenuItem className={item}>
                <UsersIcon />
                Team members
              </DropdownMenuItem>
              <DropdownMenuItem className={item}>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuItem className={item}>
                <SettingsIcon />
                Settings
                <DropdownMenuShortcut>Ctrl ,</DropdownMenuShortcut>
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
                    <DropdownMenuRadioItem value="en" className={item}>English</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="hi" className={item}>हिन्दी</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="ur" className={item}>اردو</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem className={item}>
                <KeyboardIcon />
                Keyboard shortcuts
                <DropdownMenuShortcut>?</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem className={item}>
                <LifeBuoyIcon />
                Help & docs
              </DropdownMenuItem>
              <DropdownMenuItem className={item}>
                <GiftIcon />
                What&apos;s new
                <span className="ml-auto size-1.5 rounded-full bg-brand" aria-label="New updates" />
              </DropdownMenuItem>
              <DropdownMenuItem className={item}>
                <MessageSquareIcon />
                Send feedback
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" className={item}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UserAvatar() {
  return (
    <Avatar className="size-8 rounded-md">
      <AvatarFallback className="rounded-md bg-linear-to-b from-brand to-brand-deep text-[11px] font-semibold text-white">
        {currentUser.initials}
      </AvatarFallback>
    </Avatar>
  )
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "dark") return <MoonIcon />
  if (mode === "light") return <SunIcon />
  return <MonitorIcon />
}
