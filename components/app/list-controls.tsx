"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { motion } from "motion/react"
import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { spring } from "@/lib/motion"

/** Search box that keeps its text in ?q=, so results survive a reload and can be shared. */
export function ListSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = React.useState(params.get("q") ?? "")
  const [pending, startTransition] = React.useTransition()

  React.useEffect(() => {
    const current = params.get("q") ?? ""
    if (value.trim() === current) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (value.trim()) next.set("q", value.trim())
      else next.delete("q")
      next.delete("page")
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }))
    }, 250)
    return () => clearTimeout(t)
  }, [value, params, pathname, router])

  return (
    <div className="relative w-full sm:w-72">
      {pending ? <LoaderCircleIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" /> : <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />}
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-lg border bg-background pr-8 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => setValue("")} className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export type Tab = { href: string; label: string; count?: number; tone?: "danger" }

/** Section tabs with the same sliding pill as the sidebar. Plain links: each view is its own page. */
export function ViewTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <ul className="inline-flex gap-0.5 rounded-lg border bg-muted/50 p-0.5">
        {tabs.map((t) => {
          const on = pathname === t.href
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cn("relative isolate inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors", on ? "text-foreground" : "text-foreground/60 hover:text-foreground")}
              >
                {on && <motion.span layoutId="view-tabs" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className={cn("rounded px-1 text-[10px] tabular-nums", t.tone === "danger" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-foreground/6 text-foreground/70")}>{t.count}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** "Show more" that grows ?page=, keeping the list server-rendered. */
export function LoadMore() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = React.useTransition()
  const page = Number(params.get("page")) || 1
  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const next = new URLSearchParams(params)
          next.set("page", String(page + 1))
          startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }))
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-3 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-60"
      >
        {pending && <LoaderCircleIcon className="size-3.5 animate-spin" />}
        Show more
      </button>
    </div>
  )
}
