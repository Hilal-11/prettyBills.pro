import Link from "next/link"
import { cn } from "cn"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export type Crumb = { label: string; href?: string }

/**
 * Frame for every page in the app except the editor: the same 48px top bar
 * (sidebar toggle, breadcrumbs, actions) and a scrolling body.
 */
export function PageShell({ crumbs, actions, children, wide }: { crumbs: Crumb[]; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger className="-ml-1 text-foreground/70" />
        <Separator orientation="vertical" className="mr-1 h-4 data-vertical:self-center" />
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 text-[13px]">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1
              return (
                <li key={`${c.label}-${i}`} className={cn("flex min-w-0 items-center gap-1.5", !last && "hidden sm:flex")}>
                  {c.href && !last ? (
                    <Link href={c.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined} className={cn("truncate", last ? "font-semibold" : "text-muted-foreground")}>
                      {c.label}
                    </span>
                  )}
                  {!last && <span aria-hidden className="text-muted-foreground/60">/</span>}
                </li>
              )
            })}
          </ol>
        </nav>
        {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:py-8", wide ? "max-w-7xl" : "max-w-6xl")}>{children}</div>
      </div>
    </div>
  )
}

/** Page heading with an optional description and actions on the right. */
export function PageTitle({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{title}</h1>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
