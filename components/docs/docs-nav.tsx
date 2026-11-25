"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "cn"

import { spring } from "@/lib/motion"

export type DocsNavGroup = { title: string; items: { id: string; label: string }[] }

/** Section links; the one being read is highlighted as you scroll. */
export function DocsNav({ groups }: { groups: DocsNavGroup[] }) {
  const ids = React.useMemo(() => groups.flatMap((g) => g.items.map((i) => i.id)), [groups])
  const [active, setActive] = React.useState<string | null>(null)

  React.useEffect(() => {
    const seen = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting)
        const first = ids.find((id) => seen.get(id))
        if (first) setActive(first)
      },
      { rootMargin: "-72px 0px -65% 0px" }
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ids])

  return (
    <nav aria-label="On this page" className="grid gap-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</p>
          <ul className="grid gap-0.5">
            {g.items.map((item) => {
              const on = active === item.id
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={on ? "location" : undefined}
                    className={cn("relative isolate block rounded-md px-2 py-1 text-[13px] transition-colors", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {on && <motion.span layoutId="docs-nav" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
