"use client"

import * as React from "react"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { PlusIcon, Trash2Icon, UserPlusIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { clients, gstRates, paymentMethods, sellerStateCode, states } from "@/lib/dashboard/data"
import { formatINR, invoiceTotals, taxLines } from "@/lib/landing/invoice"

import { ease, rise, spring, stagger } from "@/lib/motion"
import type { InvoiceDraftApi } from "./use-invoice-draft"

const control = "h-8 text-[13px] md:text-[13px]"

/** Right-hand panel (30%): the form that edits the invoice on the canvas. */
export function InvoiceEditor({ api }: { api: InvoiceDraftApi }) {
  const { draft, invoice, update, setClient, updateItem, addItem, removeItem } = api
  const totals = invoiceTotals(invoice)
  const interState = draft.posCode !== sellerStateCode

  return (
    <div className="flex h-full flex-col">
      <motion.div
        initial="hidden"
        animate="show"
        variants={stagger}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4 [scrollbar-width:thin]"
      >
        <Section title="Document">
          <div role="tablist" aria-label="Document type" className="grid grid-cols-2 rounded-lg border bg-muted/50 p-0.5">
            {(
              [
                { id: "invoice", label: "Invoice", hint: "Asks for payment" },
                { id: "receipt", label: "Receipt", hint: "Confirms payment" },
              ] as const
            ).map((k) => (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={draft.kind === k.id}
                onClick={() => update("kind", k.id)}
                className={cn(
                  "relative isolate rounded-md px-3 py-1.5 text-left transition-colors",
                  draft.kind === k.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {draft.kind === k.id && <motion.span layoutId="doc-kind" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
                <span className="block text-[13px]">{k.label}</span>
                <span className="block text-[11px] text-muted-foreground">{k.hint}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice no." className="col-span-2">
              <Input value={draft.number} onChange={(e) => update("number", e.target.value)} className={control} />
            </Field>
            <Field label={draft.kind === "receipt" ? "Date paid" : "Issue date"} className={cn(draft.kind === "receipt" && "col-span-2")}>
              <Input type="date" value={draft.issueDate} onChange={(e) => update("issueDate", e.target.value)} className={control} />
            </Field>
            {draft.kind === "invoice" && (
              <Field label="Due date">
                <Input type="date" value={draft.dueDate} onChange={(e) => update("dueDate", e.target.value)} className={control} />
              </Field>
            )}
          </div>
          <AnimatePresence initial={false}>
            {draft.kind === "receipt" && (
              <motion.div
                key="receipt-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease }}
                className="-m-1 overflow-hidden p-1"
              >
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Receipt no.">
                    <Input value={draft.receiptNumber} onChange={(e) => update("receiptNumber", e.target.value)} className={control} />
                  </Field>
                  <Field label="Paid via">
                    <Select
                      items={paymentMethods.map((m) => ({ value: m, label: m }))}
                      value={draft.paymentMethod}
                      onValueChange={(v) => v && update("paymentMethod", v)}
                    >
                      <SelectTrigger className={cn(control, "w-full")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((m) => (
                          <SelectItem key={m} value={m} className="text-[13px]">
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        <Section
          title="Bill to"
          action={
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs text-muted-foreground">
              <UserPlusIcon className="size-3.5" /> New client
            </Button>
          }
        >
          <Field label="Client">
            <Select
              items={clients.map((c) => ({ value: c.id, label: `${c.name} · ${c.city}` }))}
              value={draft.clientId}
              onValueChange={(v) => v && setClient(v)}
            >
              <SelectTrigger className={cn(control, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-[13px]">
                    {c.name} · {c.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Place of supply">
            <Select
              items={states.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))}
              value={draft.posCode}
              onValueChange={(v) => v && update("posCode", v)}
            >
              <SelectTrigger className={cn(control, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={s.code} value={s.code} className="text-[13px]">
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Items" action={<span className="text-xs text-muted-foreground tabular-nums">{draft.items.length} lines</span>}>
          <div className="grid grid-cols-[1fr_3.25rem_5.5rem_1.75rem] gap-2 px-0.5 text-[11px] text-muted-foreground">
            <span>Description</span>
            <span>Qty</span>
            <span>Rate (₹)</span>
            <span />
          </div>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {draft.items.map((it) => (
                <motion.li
                  key={it.id}
                  layout
                  initial={{ opacity: 0, height: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                  exit={{ opacity: 0, height: 0, filter: "blur(4px)" }}
                  transition={{ duration: 0.3, ease }}
                  className="group/item"
                >
                  <div className="grid grid-cols-[1fr_3.25rem_5.5rem_1.75rem] items-center gap-2">
                    <Input
                      value={it.name}
                      placeholder="Item or service"
                      aria-label="Item description"
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      className={control}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={it.qty}
                      aria-label="Quantity"
                      onChange={(e) => updateItem(it.id, { qty: Math.max(0, Number(e.target.value)) })}
                      className={cn(control, "px-2 tabular-nums")}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={it.rate}
                      aria-label="Rate in rupees"
                      onChange={(e) => updateItem(it.id, { rate: Math.max(0, Number(e.target.value)) })}
                      className={cn(control, "px-2 tabular-nums")}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove item"
                      onClick={() => removeItem(it.id)}
                      disabled={draft.items.length === 1}
                      className="text-muted-foreground opacity-60 transition-opacity group-hover/item:opacity-100 hover:text-destructive"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <p className="mt-1 flex justify-between px-0.5 text-[11px] text-muted-foreground tabular-nums">
                    <span>SAC {it.sac}</span>
                    <span>{formatINR(it.qty * it.rate)}</span>
                  </p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <Button variant="outline" size="sm" onClick={addItem} className="h-8 w-full border-dashed text-[13px] text-muted-foreground hover:text-foreground">
            <PlusIcon /> Add item
          </Button>
        </Section>

        <Section title="Tax">
          <div className="grid grid-cols-2 gap-3">
            <Field label="GST rate">
              <Select
                items={gstRates.map((r) => ({ value: String(r), label: `${r}%` }))}
                value={String(draft.gstRate)}
                onValueChange={(v) => v && update("gstRate", Number(v))}
              >
                <SelectTrigger className={cn(control, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gstRates.map((r) => (
                    <SelectItem key={r} value={String(r)} className="text-[13px]">
                      {r}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Applied as">
              <div className="flex h-8 items-center">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={interState ? "igst" : "split"}
                    initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                    transition={{ duration: 0.25, ease }}
                    className="rounded-md border bg-muted/50 px-2 py-1 text-[11px] whitespace-nowrap"
                  >
                    {interState ? "IGST · inter-state" : "CGST + SGST · intra"}
                  </motion.span>
                </AnimatePresence>
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Payment">
          <Field label="UPI ID">
            <Input value={draft.upiId} onChange={(e) => update("upiId", e.target.value)} className={control} />
          </Field>
          <div className="divide-y rounded-lg border">
            <Toggle label="UPI QR on invoice" hint="Scan-to-pay code" checked={draft.showQr} onChange={(v) => update("showQr", v)} />
            <Toggle label="Pay now link" hint="Cards and net banking" checked={draft.payNow} onChange={(v) => update("payNow", v)} />
            <Toggle label="Mark as paid" hint="Adds the PAID stamp" checked={draft.paid} onChange={(v) => update("paid", v)} />
          </div>
        </Section>

        <Section title="Notes">
          <Textarea
            value={draft.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            className="min-h-20 resize-none text-[13px] md:text-[13px]"
            aria-label="Notes printed on the invoice"
          />
          <p className="text-[11px] text-muted-foreground">Shown on the invoice when the UPI QR is off.</p>
        </Section>
      </motion.div>

      {/* sticky totals */}
      <div className="border-t bg-background/80 px-4 py-3 backdrop-blur">
        <dl className="space-y-1 text-[13px] tabular-nums">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal</dt>
            <dd>
              <AnimatedINR value={totals.subtotal} />
            </dd>
          </div>
          {taxLines(invoice, totals.tax).map((t) => (
            <div key={t.label} className="flex justify-between text-muted-foreground">
              <dt>{t.label}</dt>
              <dd>
                <AnimatedINR value={t.amount} />
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="font-semibold">Total</dt>
            <dd className="text-lg font-semibold tracking-tight">
              <AnimatedINR value={totals.total} />
            </dd>
          </div>
        </dl>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-8 text-[13px]">
            Save draft
          </Button>
          <Button className="h-8 text-[13px]">Send invoice</Button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section variants={rise} className="space-y-3 border-b border-dashed pt-2 pb-5 last:border-0">
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </header>
      {children}
    </motion.section>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-xs text-foreground/80">{label}</span>
      {children}
    </label>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
      <span className="grid leading-tight">
        <span className="text-[13px]">{label}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="data-checked:bg-brand" />
    </label>
  )
}

/** Rupee amount that counts smoothly to its new value. */
function AnimatedINR({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 220, damping: 30 })
  const text = useTransform(spring, (v) => formatINR(Math.round(v)))
  React.useEffect(() => {
    spring.set(value)
  }, [spring, value])
  return <motion.span>{text}</motion.span>
}
