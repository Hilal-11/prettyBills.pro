import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { cn } from "cn"

import { BrandLockup } from "@/components/brand"
import { ThemeToggle } from "@/components/landing/theme-toggle"
import { buttonVariants } from "@/components/ui/button"

import { DocsNav, type DocsNavGroup } from "./docs-nav"

const SITES = [
  { href: "/help", label: "Help center" },
  { href: "/developers", label: "Developer docs" },
] as const

/**
 * Shared frame for the help center and the developer docs: a sticky header
 * with both sites, a section nav that follows the reader, and the content.
 */
export function DocsShell({
  site,
  eyebrow,
  title,
  description,
  nav,
  children,
}: {
  site: (typeof SITES)[number]["href"]
  eyebrow: string
  title: string
  description: string
  nav: DocsNavGroup[]
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="PrettyBills home" className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <BrandLockup size={28} />
          </Link>
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <nav aria-label="Documentation" className="flex items-center gap-0.5">
            {SITES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                aria-current={s.href === site ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  s.href === site ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "hidden h-8 gap-1.5 text-[13px] sm:inline-flex")}>
              Open dashboard <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="relative isolate border-b">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-brand/6 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6">
          <p className="text-xs font-semibold tracking-wide text-brand uppercase dark:text-[#6da2ff]">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100svh-6rem)] overflow-y-auto pb-6">
            <DocsNav groups={nav} />
          </div>
        </aside>
        <main className="min-w-0 max-w-3xl">{children}</main>
      </div>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 PrettyBills · Made in Kashmir, India</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <Link href="/help" className="hover:text-foreground">Help center</Link>
            <Link href="/developers" className="hover:text-foreground">Developer docs</Link>
            <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
