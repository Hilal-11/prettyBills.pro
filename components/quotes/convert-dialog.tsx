"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangleIcon, FileTextIcon, LoaderCircleIcon, ScrollTextIcon } from "lucide-react"
import { cn } from "cn"

import { conversionInfoAction, convertQuoteAction, type ConversionInfo } from "@/app/(app)/quotes/actions"
import { useToast } from "@/components/invoice-editor/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR } from "@/lib/billing/money"
import { checkConversion, conversionDocument, quoteLabel, type ConversionLine } from "@/lib/billing/quotes"
import { invoicesChanged } from "@/lib/client/workspace"
import { computeInvoiceTotals } from "@/lib/invoice/totals"

type Target = "invoice" | "proforma"

/**
 * "Convert QT/26-27/001 to: ◉ Invoice ○ Proforma". With multiple invoices per
 * quote turned on, pick lines and quantities (up to what's left) for
 * milestone billing. Shows the new total, then opens the new draft.
 */
export function ConvertDialog({ quoteId, open, onOpenChange, target: initial = "invoice" }: { quoteId: string; open: boolean; onOpenChange: (o: boolean) => void; target?: Target }) {
  const router = useRouter()
  const toast = useToast()
  const [info, setInfo] = React.useState<ConversionInfo | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [target, setTarget] = React.useState<Target>(initial)
  const [picked, setPicked] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [key, setKey] = React.useState("")

  const [lastOpen, setLastOpen] = React.useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setInfo(null)
      setLoadError(null)
      setError(null)
      setTarget(initial)
      setKey(crypto.randomUUID())
    }
  }

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void conversionInfoAction(quoteId).then((res) => {
      if (cancelled) return
      if (!res.ok) return setLoadError(res.error)
      setInfo(res.info)
      // everything that's left, ticked
      setPicked(Object.fromEntries(res.info.remaining.filter((r) => r.remaining > 0).map((r) => [r.id, String(r.remaining)])))
    })
    return () => {
      cancelled = true
    }
  }, [open, quoteId])

  const multi = !!info?.allowMultiple
  const lines: ConversionLine[] = React.useMemo(() => Object.entries(picked).map(([id, q]) => ({ id, qty: Number(q) })), [picked])
  const problem = info ? (multi ? checkConversion(lines, info.remaining) : info.remaining.some((r) => r.remaining > 0) ? null : "Everything on this quote has been invoiced.") : null
  const blocked = info ? (info.status === "declined" ? "The client declined this quote. Revise it to make a new offer before converting." : info.status === "void" ? "This quote is void." : null) : null
  const preview = React.useMemo(() => {
    if (!info) return null
    const partial = multi || info.remaining.some((r) => r.converted > 0)
    const use = multi ? lines : info.remaining.filter((r) => r.remaining > 0).map((r) => ({ id: r.id, qty: r.remaining }))
    const doc = conversionDocument(info.document, { kind: info.kind, id: info.id, number: info.number }, target, { newId: "preview", today: info.document.issueDate, lines: partial ? use : null })
    return computeInvoiceTotals(doc)
  }, [info, multi, lines, target])

  async function submit() {
    if (!info || problem || blocked) return
    setBusy(true)
    setError(null)
    const res = await convertQuoteAction({ id: quoteId, target, lines: multi ? lines : null, key })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    invoicesChanged()
    onOpenChange(false)
    toast({ title: target === "invoice" ? "Draft invoice created" : "Draft proforma created", description: `From ${quoteLabel(info.number, info.revision)} · ${formatINR(res.total)}`, tone: "success" })
    router.push(res.targetType === "invoice" ? `/invoices/${res.targetId}` : `/quotes/${res.targetId}/edit`)
  }

  const label = info ? quoteLabel(info.number, info.revision) : ""
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="gap-4 p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Convert {label || (info?.kind === "proforma" ? "proforma" : "quote")}</DialogTitle>
          <DialogDescription>Client, items, notes, terms, template and signature are copied into a new draft dated today.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {loadError}
          </p>
        ) : !info ? (
          <div className="grid gap-2" aria-busy="true">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : (
          <div className="grid gap-3">
            {info.kind === "quote" && (
              <div role="radiogroup" aria-label="Convert to" className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["invoice", "Invoice", "A draft tax invoice", FileTextIcon],
                    ["proforma", "Proforma", "Ask for an advance first", ScrollTextIcon],
                  ] as const
                ).map(([v, title, hint, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={target === v}
                    onClick={() => setTarget(v)}
                    className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50", target === v ? "border-brand/50 bg-brand/5" : "hover:bg-muted/40")}
                  >
                    <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", target === v && "border-brand")}>{target === v && <span className="size-2 rounded-full bg-brand" />}</span>
                    <span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <Icon className="size-3.5 text-foreground/60" /> {title}
                      </span>
                      <span className="text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {info.expired && !blocked && (
              <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangleIcon className="mt-px size-3.5 shrink-0" /> This quote has expired. Check the prices still stand before invoicing.
              </p>
            )}
            {blocked && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {blocked}
              </p>
            )}

            {multi && !blocked && (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-[13px]">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="w-8 px-2 py-1.5 text-left font-normal">
                        <span className="sr-only">Include</span>
                      </th>
                      <th scope="col" className="px-2 py-1.5 text-left font-normal">
                        Item
                      </th>
                      <th scope="col" className="px-2 py-1.5 text-right font-normal">
                        Left
                      </th>
                      <th scope="col" className="w-24 px-2 py-1.5 text-right font-normal">
                        Invoice now
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.remaining.map((r) => {
                      const on = r.id in picked
                      const done = r.remaining <= 0
                      return (
                        <tr key={r.id} className={cn("border-t", done && "text-muted-foreground")}>
                          <td className="px-2 py-1.5">
                            <Checkbox
                              aria-label={`Include ${r.name}`}
                              disabled={done}
                              checked={on}
                              onCheckedChange={(v) =>
                                setPicked((p) => {
                                  const n = { ...p }
                                  if (v) n[r.id] = String(r.remaining)
                                  else delete n[r.id]
                                  return n
                                })
                              }
                            />
                          </td>
                          <td className="max-w-0 truncate px-2 py-1.5">{r.name}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                            {r.remaining} of {r.qty} {r.unit}
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              aria-label={`Quantity of ${r.name} to invoice`}
                              inputMode="decimal"
                              disabled={!on || done}
                              value={on ? picked[r.id] : ""}
                              onChange={(e) => setPicked((p) => ({ ...p, [r.id]: e.target.value.replace(/[^\d.]/g, "") }))}
                              className="h-7 text-right text-[13px] tabular-nums"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!blocked && (
              <div className="flex items-baseline justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-[13px]">
                <span className="text-muted-foreground">{multi && info.convertedPaise > 0 ? `${formatINR(info.convertedPaise)} of ${formatINR(info.total)} invoiced so far · new draft` : "New draft total"}</span>
                <span className="text-base font-semibold tabular-nums">{preview ? formatINR(preview.total) : "—"}</span>
              </div>
            )}
            {(problem || error) && !blocked && (
              <p role="alert" className="text-xs text-destructive">
                {error ?? problem}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="-mx-5 -mb-5 p-4">
          <Button variant="outline" className="h-8 text-[13px]" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="h-8 text-[13px]" disabled={!info || busy || !!problem || !!blocked} onClick={() => void submit()}>
            {busy && <LoaderCircleIcon className="animate-spin" />}
            {target === "invoice" ? "Create draft invoice" : "Create draft proforma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
