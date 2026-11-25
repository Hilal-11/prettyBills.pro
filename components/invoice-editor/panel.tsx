"use client"

import * as React from "react"
import { motion } from "motion/react"
import { ChevronUpIcon, InfoIcon, SendIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatMoney } from "@/lib/invoice/totals"
import { stagger, rise } from "@/lib/motion"

import { BusinessSection } from "./sections/business"
import { ClientSection } from "./sections/client"
import { DetailsSection } from "./sections/details"
import { ItemsSection } from "./sections/items"
import { MoreSection } from "./sections/more"
import { NotesSection } from "./sections/notes"
import { PaymentSection } from "./sections/payment"
import { SignatureSection } from "./sections/signature"
import { TaxSection } from "./sections/tax"
import type { EditorApi } from "./use-editor"

/** The edit panel: sections and the sticky totals footer. */
export function EditPanel({ ed, onSend, onSaveDraft, wide }: { ed: EditorApi; onSend: () => void; onSaveDraft: () => void; wide?: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin]">
        <div className={cn("mx-auto px-4 pt-1 pb-6", wide ? "max-w-[760px]" : "")}>
          {ed.invoice.sentAt && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-brand-deep dark:text-[#8fb5ff]">
              <InfoIcon className="mt-px size-3.5 shrink-0" />
              <span>
                This invoice was sent. Changes will create a revised version
                {ed.invoice.revision > 1 ? ` (revision ${ed.invoice.revision})` : ""}.
              </span>
            </div>
          )}

          <motion.div initial="hidden" animate="show" variants={stagger} className="mt-3 space-y-2.5">
            {[BusinessSection, ClientSection, DetailsSection, ItemsSection, TaxSection, PaymentSection, NotesSection, SignatureSection, MoreSection].map((S, i) => (
              <motion.div key={i} variants={rise}>
                <S ed={ed} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      <StickyFooter ed={ed} onSend={onSend} onSaveDraft={onSaveDraft} />
    </div>
  )
}

function StickyFooter({ ed, onSend, onSaveDraft }: { ed: EditorApi; onSend: () => void; onSaveDraft: () => void }) {
  const t = ed.totals
  return (
    <div className="flex shrink-0 items-center gap-3 border-t bg-background/95 px-4 py-2.5 backdrop-blur">
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] tabular-nums transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        >
          <span className="min-w-0 truncate text-foreground/75">
            Subtotal {formatMoney(t.subtotal)} · Tax {formatMoney(t.taxTotal)} · <span className="font-semibold text-foreground">Total {formatMoney(t.total, { whole: true })}</span>
          </span>
          <ChevronUpIcon className="size-3.5 shrink-0 text-foreground/50 transition-transform group-data-popup-open:rotate-180" />
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-80 text-[13px] tabular-nums">
          <dl className="space-y-1">
            <Line k="Subtotal" v={formatMoney(t.subtotal)} />
            {t.invoiceDiscount > 0 && <Line k="Discount" v={`−${formatMoney(t.invoiceDiscount)}`} />}
            {t.charges.map((c) => (
              <Line key={c.id} k={c.label || "Charge"} v={formatMoney(c.amount)} />
            ))}
            {t.taxRows.map((r) => (
              <Line key={`${r.kind}${r.rate}`} k={`${r.kind} ${r.rate}% on ${formatMoney(r.taxable)}`} v={formatMoney(r.amount)} />
            ))}
            {t.tcs > 0 && <Line k="TCS" v={formatMoney(t.tcs)} />}
            {t.roundOff !== 0 && <Line k="Round off" v={formatMoney(t.roundOff, { sign: true })} />}
            <Line k="Total" v={formatMoney(t.total)} strong />
            {t.amountPaid > 0 && (
              <>
                <Line k="Amount paid" v={`−${formatMoney(t.amountPaid)}`} />
                <Line k="Balance due" v={formatMoney(t.balanceDue)} strong />
              </>
            )}
          </dl>
        </PopoverContent>
      </Popover>
      <Button variant="outline" className="h-8 shrink-0 text-[13px]" onClick={onSaveDraft}>
        Save draft
      </Button>
      <Button className="h-8 shrink-0 text-[13px]" onClick={onSend}>
        <SendIcon /> Send invoice
      </Button>
    </div>
  )
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong ? "border-t pt-1 font-semibold" : "text-foreground/80")}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}
