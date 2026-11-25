"use client"

import * as React from "react"
import { ChevronDownIcon, CircleCheckIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { SectionId } from "@/lib/invoice/validate"

import type { EditorApi } from "./use-editor"

/** Collapsible card: icon · title · summary (collapsed) · completion · chevron. */
export function SectionCard({
  ed,
  id,
  icon: Icon,
  title,
  summary,
  action,
  children,
}: {
  ed: EditorApi
  id: SectionId
  icon: LucideIcon
  title: string
  summary?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const open = ed.open.has(id)
  const state = ed.validation.sections[id]

  return (
    <Collapsible
      open={open}
      onOpenChange={(v) => ed.toggleSection(id, v)}
      render={<section ref={(el: HTMLElement | null) => ed.registerSection(id, el)} id={`section-${id}`} aria-labelledby={`section-${id}-title`} />}
      className={cn("scroll-mt-14 rounded-xl border bg-card/60 transition-colors", open && "bg-card")}
      onFocusCapture={() => ed.setHighlight(id)}
    >
      <div className="flex items-center gap-2 pr-2">
        <CollapsibleTrigger className="group/section flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-background text-foreground/80">
            <Icon className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span id={`section-${id}-title`} className="block text-[13px] font-semibold">
              {title}
            </span>
            {!open && summary && <span className="block truncate text-xs text-foreground/65">{summary}</span>}
          </span>
          {state.complete ? (
            <CircleCheckIcon className="size-4 shrink-0 text-emerald-500" aria-label="Complete" />
          ) : (
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-brand dark:text-[#6da2ff]" aria-label={`${state.issues} to fix`}>
              <span className="size-2 rounded-full bg-brand" />
              {state.issues}
            </span>
          )}
          <ChevronDownIcon className="size-4 shrink-0 text-foreground/50 transition-transform duration-200 group-data-panel-open/section:rotate-180" />
        </CollapsibleTrigger>
        {open && action}
      </div>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.2,0,0,1)] data-ending-style:h-0 data-starting-style:h-0">
        <div className="space-y-4 border-t px-3.5 pt-4 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
