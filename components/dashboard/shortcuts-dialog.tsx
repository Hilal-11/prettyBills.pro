"use client"

import * as React from "react"
import { motion } from "motion/react"
import { KeyboardIcon } from "lucide-react"
import { cn } from "cn"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useKeyLabels } from "@/lib/client/platform"
import { ease } from "@/lib/motion"

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-grid h-5 min-w-5 place-items-center rounded-[5px] border border-b-2 bg-background px-1.5 font-sans text-[11px] font-medium text-foreground/80 tabular-nums",
        className
      )}
    >
      {children}
    </kbd>
  )
}

/** "Ctrl+Shift+Z" style combo, each key its own chip. */
export function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <Kbd key={i}>{k}</Kbd>
      ))}
    </span>
  )
}

type Shortcut = { label: string; keys: string[][]; note?: string }

function useGroups(): { title: string; items: Shortcut[] }[] {
  const { mod, alt, shift, mac } = useKeyLabels()
  return [
    {
      title: "General",
      items: [
        { label: "Search invoices, clients and pages", keys: [[mod, "K"]] },
        { label: "Show keyboard shortcuts", keys: [["?"], [mod, "/"]] },
        { label: "Open settings", keys: [[mod, ","]] },
        { label: "Show or hide the sidebar", keys: [[mod, "B"]] },
        { label: "Close a dialog or menu", keys: [["Esc"]] },
      ],
    },
    {
      title: "Invoice editor",
      items: [
        { label: "Save draft", keys: [[mod, "S"]], note: "Signed-in invoices also save themselves as you type" },
        { label: "Undo", keys: [[mod, "Z"]] },
        { label: "Redo", keys: mac ? [[mod, shift, "Z"]] : [[mod, shift, "Z"], [mod, "Y"]] },
        { label: "Form only", keys: [[alt, "1"]] },
        { label: "Preview only", keys: [[alt, "2"]] },
        { label: "Form and preview side by side", keys: [[alt, "3"]] },
        { label: "Add another item", keys: [["Enter"]], note: "While in the rate of the last item" },
      ],
    },
    {
      title: "Forms",
      items: [
        { label: "Send feedback", keys: [[mod, "Enter"]], note: "In the feedback box" },
        { label: "Next field", keys: [["Tab"]] },
        { label: "Previous field", keys: [[shift, "Tab"]] },
      ],
    },
  ]
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const groups = useGroups()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(680px,90dvh)] gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/50">
            <KeyboardIcon className="size-4.5" />
          </span>
          <div className="grid gap-0.5">
            <DialogTitle className="text-[15px] font-semibold">Keyboard shortcuts</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Press <Kbd className="mx-0.5">?</Kbd> anywhere in the dashboard to open this list.
            </DialogDescription>
          </div>
        </div>
        <div className="max-h-[calc(min(680px,90dvh)-73px)] overflow-y-auto px-5 pt-2 pb-5">
          {groups.map((g, gi) => (
            <motion.section key={g.title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: gi * 0.05 }} className="mt-3">
              <h3 className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</h3>
              <ul className="divide-y rounded-lg border bg-background">
                {g.items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-4 px-3 py-2.5">
                    <span className="grid gap-0.5">
                      <span className="text-[13px]">{s.label}</span>
                      {s.note && <span className="text-[11px] text-muted-foreground">{s.note}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {s.keys.map((combo, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-[11px] text-muted-foreground">or</span>}
                          <Keys keys={combo} />
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
