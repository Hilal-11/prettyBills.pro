"use client"

import { motion } from "motion/react"
import { CheckIcon, GiftIcon, MessageSquareIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { changelog } from "@/lib/dashboard/changelog"
import { ease } from "@/lib/motion"

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" })

const tagTone = {
  New: "bg-brand/10 text-brand dark:bg-brand/20 dark:text-[#6da2ff]",
  Improved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Fixed: "bg-muted text-muted-foreground",
} as const

export function WhatsNewDialog({ open, onOpenChange, onOpenFeedback }: { open: boolean; onOpenChange: (open: boolean) => void; onOpenFeedback: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(700px,90dvh)] gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <div className="relative border-b px-5 pt-5 pb-4">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-brand/8 to-transparent" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-linear-to-b from-brand to-brand-deep text-white shadow-[0_2px_0_var(--brand-shadow)]">
              <GiftIcon className="size-4.5" />
            </span>
            <div className="grid gap-0.5">
              <DialogTitle className="text-[15px] font-semibold">What&apos;s new</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Recent changes to PrettyBills.</DialogDescription>
            </div>
          </div>
        </div>

        <ol className="max-h-[calc(min(700px,90dvh)-140px)] overflow-y-auto px-5 py-4">
          {changelog.map((entry, i) => (
            <motion.li
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease, delay: i * 0.05 }}
              className="relative grid grid-cols-[14px_1fr] gap-x-3 pb-6 last:pb-1"
            >
              {/* timeline */}
              <span className="relative flex justify-center">
                <span className={cn("mt-1.5 size-2.5 rounded-full border-2 border-background ring-1", i === 0 ? "bg-brand ring-brand/40" : "bg-muted-foreground/40 ring-border")} />
                {i < changelog.length - 1 && <span className="absolute top-5 bottom-[-6px] w-px bg-border" />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <time dateTime={entry.date} className="text-[11px] text-muted-foreground">
                    {dateFmt.format(new Date(entry.date))}
                  </time>
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", tagTone[entry.tag])}>{entry.tag}</span>
                </div>
                <h3 className="mt-1 text-[14px] font-semibold tracking-[-0.01em]">{entry.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{entry.body}</p>
                {entry.points && (
                  <ul className="mt-2 space-y-1.5">
                    {entry.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-[13px]">
                        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand/15 text-brand dark:text-[#6da2ff]">
                          <CheckIcon className="size-3" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.li>
          ))}
        </ol>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
          <p className="text-xs text-muted-foreground">Missing something you need?</p>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenFeedback}>
            <MessageSquareIcon /> Tell us
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
