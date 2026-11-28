"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { BadgeCheckIcon, LoaderCircleIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { setTdsCertificateAction } from "@/app/(app)/payments/actions"
import { useToast } from "@/components/invoice-editor/toast"
import { ClientChip } from "@/components/invoices/client-chip"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { formatINR } from "@/lib/billing/money"
import { tdsLabel, type TdsClientRow } from "@/lib/billing/tds"
import { spring } from "@/lib/motion"

type Quarter = { q: number; label: string; months: string; total: number; rows: TdsClientRow[] }

/**
 * The TDS tab: per FY quarter, what each client deducted, under which
 * sections, and whether their TDS certificate (Form 16A) has arrived.
 * Toggle one row, or tick several and mark them together.
 */
export function TdsReport({ quarters, fy }: { quarters: Quarter[]; fy: string }) {
  const toast = useToast()
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set())
  const [busy, setBusy] = React.useState<string | null>(null)
  const allRows = quarters.flatMap((q) => q.rows.map((r) => ({ ...r, id: `${q.q}:${r.key}` })))

  const set = async (busyKey: string, ids: string[], received: boolean) => {
    setBusy(busyKey)
    const r = await setTdsCertificateAction(ids, received).catch(() => ({ ok: false as const, error: "You seem to be offline. Try again." }))
    setBusy(null)
    if (!r.ok) return toast({ title: r.error, tone: "error" })
    setPicked(new Set())
    toast({ title: received ? "Marked as certificate received" : "Marked as certificate pending", description: `${r.changed} payment${r.changed === 1 ? "" : "s"} updated.`, tone: "success", duration: 2500 })
  }

  const chosen = allRows.filter((r) => picked.has(r.id))
  const chosenIds = chosen.flatMap((r) => r.paymentIds)

  return (
    <div>
      <p className="border-b px-4 py-2 text-xs text-muted-foreground">
        FY {fy} · <span className="font-semibold text-foreground tabular-nums">{formatINR(quarters.reduce((s, q) => s + q.total, 0))}</span> TDS deducted by clients. Match these with your Form 26AS / AIS.
      </p>
      <AnimatePresence>
        {chosen.length > 0 && (
          <motion.div
            role="toolbar"
            aria-label="Selected clients"
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 12, x: "-50%" }}
            transition={spring}
            className="fixed bottom-6 left-1/2 z-40 flex items-center gap-1 rounded-xl border bg-popover p-1.5 text-[13px] text-popover-foreground shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]"
          >
            <span className="px-2 font-medium tabular-nums">{chosen.length} selected</span>
            <span className="h-4 w-px bg-border" />
            <Button variant="ghost" className="h-8 gap-1.5 px-2.5 text-[13px]" disabled={!!busy} onClick={() => set("bulk-on", chosenIds, true)}>
              {busy === "bulk-on" ? <LoaderCircleIcon className="animate-spin" /> : <BadgeCheckIcon />} Certificate received
            </Button>
            <Button variant="ghost" className="h-8 px-2.5 text-[13px]" disabled={!!busy} onClick={() => set("bulk-off", chosenIds, false)}>
              Mark pending
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => setPicked(new Set())}>
              <XIcon />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {quarters.map((q) => (
        <section key={q.q} aria-label={`${q.label} ${q.months}`} className="border-b">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-muted/60 px-4 py-2 backdrop-blur">
            <h3 className="text-[13px] font-semibold">
              {q.label} <span className="font-normal text-muted-foreground">· {q.months}</span>
            </h3>
            <span className="text-[13px] font-semibold tabular-nums">{formatINR(q.total)}</span>
          </header>
          {q.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 px-4 py-2">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-2 py-2 font-normal">Client</th>
                    <th className="px-4 py-2 font-normal">PAN</th>
                    <th className="px-4 py-2 font-normal">Section</th>
                    <th className="px-4 py-2 text-right font-normal">Invoices</th>
                    <th className="px-4 py-2 text-right font-normal">TDS</th>
                    <th className="px-4 py-2 text-right font-normal">Certificate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {q.rows.map((r) => {
                    const id = `${q.q}:${r.key}`
                    const on = picked.has(id)
                    return (
                      <tr key={id} className={cn("transition-colors hover:bg-muted/30", on && "bg-brand/5")}>
                        <td className="px-4 py-2.5">
                          <Checkbox
                            aria-label={`Select ${r.clientName} in ${q.label}`}
                            checked={on}
                            onCheckedChange={(v) =>
                              setPicked((p) => {
                                const n = new Set(p)
                                if (v) n.add(id)
                                else n.delete(id)
                                return n
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <ClientChip name={r.clientName} />
                            {r.clientId ? (
                              <Link href={`/clients/${encodeURIComponent(r.clientId)}`} className="truncate font-medium hover:underline">
                                {r.clientName}
                              </Link>
                            ) : (
                              <span className="truncate font-medium">{r.clientName}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">{r.clientPan || "—"}</td>
                        <td className="max-w-56 truncate px-4 py-2.5 text-foreground/85">{r.sections.map(tdsLabel).join(", ") || "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.invoices}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatINR(r.tds)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center gap-2">
                            <span className={cn("text-xs", r.certificate === "all" ? "text-emerald-700 dark:text-emerald-400" : r.certificate === "some" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                              {r.certificate === "all" ? "Received" : r.certificate === "some" ? "Partly" : "Pending"}
                            </span>
                            {busy === id ? (
                              <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Switch aria-label={`Certificate received from ${r.clientName} for ${q.label}`} checked={r.certificate === "all"} onCheckedChange={(v) => set(id, r.paymentIds, v)} disabled={!!busy} />
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-4 text-[13px] text-muted-foreground">No TDS deducted in {q.months}.</p>
          )}
        </section>
      ))}
    </div>
  )
}
