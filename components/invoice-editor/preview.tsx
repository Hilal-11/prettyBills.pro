"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { MinusIcon, PlusIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { InvoiceDocument } from "@/components/landing/invoice-document"
import { templateMeta } from "@/lib/invoice/templates"
import type { SectionId } from "@/lib/invoice/validate"
import { ease } from "@/lib/motion"

import type { EditorApi } from "./use-editor"

const ZOOMS = [0.5, 0.65, 0.8, 0.9, 1, 1.15, 1.3, 1.5]
const REGION_TO_SECTION: Record<string, SectionId> = {
  business: "business",
  client: "client",
  details: "details",
  items: "items",
  tax: "tax",
  payment: "payment",
  notes: "notes",
  signature: "signature",
  more: "more",
}

/** Live invoice preview on a flat canvas. Click a region to edit it. */
export function Preview({ ed, interactive = true, className }: { ed: EditorApi; interactive?: boolean; className?: string }) {
  const [zoomIndex, setZoomIndex] = React.useState(4)
  const zoom = ZOOMS[zoomIndex]
  const receipt = templateMeta(ed.invoice.templateId).size === "80mm"

  function onClick(e: React.MouseEvent) {
    if (!interactive) return
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-region]")
    if (!el) return
    const section = REGION_TO_SECTION[el.dataset.region ?? ""]
    if (!section) return
    const itemId = (e.target as HTMLElement).closest<HTMLElement>("[data-item]")?.dataset.item
    if (ed.view === "preview") ed.setView("both")
    ed.focusSection(section, itemId ? `items.${itemId}.name` : undefined)
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
        <span className="text-xs text-foreground/70">
          {templateMeta(ed.invoice.templateId).name} · {receipt ? "80 mm" : "A4"} · {ed.invoice.pageColor === "black" ? "Black page" : "White page"}
        </span>
        <div className="flex items-center gap-0.5 rounded-md border bg-background p-0.5">
          <Button variant="ghost" size="icon-xs" aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex((i) => i - 1)}>
            <MinusIcon />
          </Button>
          <button type="button" onClick={() => setZoomIndex(4)} title="Reset zoom" className="w-11 rounded text-center text-[11px] text-foreground/75 tabular-nums hover:text-foreground">
            {Math.round(zoom * 100)}%
          </button>
          <Button variant="ghost" size="icon-xs" aria-label="Zoom in" disabled={zoomIndex === ZOOMS.length - 1} onClick={() => setZoomIndex((i) => i + 1)}>
            <PlusIcon />
          </Button>
        </div>
      </div>

      {/* flat canvas: one step darker than the panel, no pattern */}
      <div className="min-h-0 flex-1 overflow-auto bg-muted/60 dark:bg-black/30">
        <motion.div animate={{ width: (receipt ? 420 : 640) * zoom }} transition={{ duration: 0.3, ease }} className="mx-auto my-8 max-w-[calc(100%-2rem)] min-w-[240px]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`${ed.invoice.templateId}-${ed.invoice.pageColor}`}
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
              transition={{ duration: 0.35, ease }}
              onClick={onClick}
              data-highlight={ed.highlight ?? undefined}
              className={cn("overflow-hidden rounded-md shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_24px_48px_-24px_rgb(0_0_0/0.4)]", interactive && "pb-linkable")}
            >
              <InvoiceDocument invoice={ed.invoice} fill />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
