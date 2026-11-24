"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { MinusIcon, PlusIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { InvoiceDocument } from "@/components/landing/invoice-document"
import { editorTemplates } from "@/lib/dashboard/data"

import { ease, spring } from "@/lib/motion"
import type { InvoiceDraftApi } from "./use-invoice-draft"

const zoomSteps = [0.6, 0.75, 0.9, 1, 1.15, 1.3]

/** Left/main panel (70%): template tabs, zoom, and the live invoice on a dotted board. */
export function InvoiceCanvas({ api }: { api: InvoiceDraftApi }) {
  const { draft, invoice, update } = api
  const [zoomIndex, setZoomIndex] = React.useState(3)
  const zoom = zoomSteps[zoomIndex]

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <div role="tablist" aria-label="Invoice template" className="flex min-w-0 overflow-x-auto [scrollbar-width:none]">
          {editorTemplates.map((t) => {
            const selected = t.slug === draft.template
            return (
              <button
                key={t.slug}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => update("template", t.slug)}
                className={cn(
                  "relative isolate shrink-0 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {selected && (
                  <motion.span layoutId="canvas-template-tab" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />
                )}
                {t.name}
                {t.recommended && (
                  <span className="ml-1.5 rounded bg-brand/10 px-1 py-px text-[10px] text-brand dark:bg-brand/20 dark:text-[#6da2ff]">Recommended</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-md border bg-background p-0.5">
          <Button variant="ghost" size="icon-xs" aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex((i) => i - 1)}>
            <MinusIcon />
          </Button>
          <button
            type="button"
            onClick={() => setZoomIndex(3)}
            className="w-11 rounded text-center text-[11px] text-muted-foreground tabular-nums hover:text-foreground"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button variant="ghost" size="icon-xs" aria-label="Zoom in" disabled={zoomIndex === zoomSteps.length - 1} onClick={() => setZoomIndex((i) => i + 1)}>
            <PlusIcon />
          </Button>
        </div>
      </div>

      {/* board */}
      <div className="relative min-h-0 flex-1 overflow-auto bg-muted/40 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] dark:bg-muted/20">
        <motion.div
          animate={{ width: 620 * zoom }}
          transition={{ duration: 0.35, ease }}
          className="mx-auto my-8 max-w-[calc(100%-2rem)] min-w-[280px]"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={draft.template}
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.4, ease }}
              className="overflow-hidden rounded-md bg-paper shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_24px_48px_-24px_rgb(0_0_0/0.35)]"
            >
              <InvoiceDocument template={draft.template} invoice={invoice} fill />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
