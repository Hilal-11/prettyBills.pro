"use client"

import * as React from "react"
import Link from "next/link"
import { LoaderCircleIcon, PlusIcon, SendIcon, WalletIcon } from "lucide-react"
import { cn } from "cn"

import { markSentAction } from "@/app/(app)/payments/actions"
import { ModeIcon } from "@/components/payments/mode-icon"
import { PaymentMenu } from "@/components/payments/payment-menu"
import { RecordPaymentDialog } from "@/components/payments/record-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, todayIST } from "@/lib/billing/dates"
import { MODE_LABEL } from "@/lib/billing/modes"
import { reasonLabel } from "@/lib/billing/credit-notes"
import { formatINR } from "@/lib/billing/money"
import { tdsLabel } from "@/lib/billing/tds"
import { invoicesChanged } from "@/lib/client/workspace"
import type { PaymentResult, PaymentRow } from "@/lib/data/types"

import { useToast } from "./toast"
import type { EditorApi } from "./use-editor"

/**
 * Payments on the invoice open in the editor: each one with its receipt, the
 * total received and the balance, and Record payment. Drafts get a way to
 * mark the invoice as sent first, since payments need a sent invoice.
 */
export function PaymentsCard({ ed }: { ed: EditorApi }) {
  const toast = useToast()
  const inv = ed.invoice
  const [rows, setRows] = React.useState<PaymentRow[] | null>(null)
  const [notes, setNotes] = React.useState<LinkedCreditNote[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [marking, setMarking] = React.useState(false)
  const { paymentsVersion, recordOpen, setRecordOpen, applyPayment } = ed
  const saved = !ed.guest && ed.save.status !== "idle"

  React.useEffect(() => {
    if (!saved || inv.status === "draft") return
    let live = true
    fetch(`/api/invoices/${encodeURIComponent(inv.id)}/payments`)
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { payments?: PaymentRow[]; creditNotes?: LinkedCreditNote[]; error?: string }
        if (!live) return
        if (r.ok && body.payments) {
          setRows(body.payments)
          setNotes(body.creditNotes ?? [])
          setError(null)
        } else setError(body.error ?? "Couldn't load payments.")
      })
      .catch(() => live && setError("You seem to be offline."))
    return () => {
      live = false
    }
  }, [inv.id, inv.status, saved, paymentsVersion])

  if (ed.guest || !saved || inv.status === "void") return null

  const total = ed.totals.total
  const paid = inv.payment.amountPaid
  const balance = Math.max(0, total - paid)
  const overdue = balance > 0 && !!inv.dueDate && inv.dueDate < todayIST()
  // settled = payments (received + TDS) + credits applied
  const credited = rows ? Math.max(0, paid - rows.reduce((s, p) => s + p.amount + p.tdsPaise, 0)) : 0
  const onChanged = (r: PaymentResult) => applyPayment(r)

  if (inv.status === "draft") {
    const ready = ed.validation.requiredMissing === 0
    return (
      <section id="payments" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-[13px]">
        <WalletIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-foreground/75">Sent it as a PDF, a link or on WhatsApp? Mark it as sent to start recording payments.</span>
        <Button
          variant="outline"
          className="h-7 gap-1.5 px-2.5 text-xs"
          disabled={!ready || marking}
          title={ready ? undefined : "Fill in the required fields first"}
          onClick={async () => {
            setMarking(true)
            await ed.flush()
            const r = await markSentAction(inv.id).catch(() => ({ ok: false as const, error: "You seem to be offline. Try again." }))
            setMarking(false)
            if (!r.ok) return toast({ title: r.error, tone: "error" })
            ed.applyServer({ status: r.status as typeof inv.status })
            invoicesChanged()
            toast({ title: `${inv.number} marked as sent`, tone: "success", duration: 2500 })
          }}
        >
          {marking ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />} Mark as sent
        </Button>
      </section>
    )
  }

  return (
    <section id="payments" aria-labelledby="payments-title" className="mt-3 scroll-mt-14 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-background text-foreground/80">
          <WalletIcon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span id="payments-title" className="block text-[13px] font-semibold">
            Payments
          </span>
          <span className="block truncate text-xs text-foreground/65 tabular-nums">{paid ? `${formatINR(paid)} of ${formatINR(total)} settled` : "Nothing received yet"}</span>
        </span>
        {balance > 0 && (
          <Button variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => setRecordOpen(true)}>
            <PlusIcon /> Record payment
          </Button>
        )}
      </div>

      <div className="border-t">
        {error ? (
          <p className="px-3.5 py-4 text-[13px] text-destructive">{error}</p>
        ) : rows === null ? (
          <div className="grid gap-2 px-3.5 py-3">
            <Skeleton className="h-8 rounded-md" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-3.5 py-5 text-center">
            <p className="text-[13px] text-muted-foreground">No payments yet</p>
            <Button className="mt-2.5 h-8 gap-1.5 px-3 text-[13px]" onClick={() => setRecordOpen(true)}>
              <PlusIcon /> Record payment
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 px-3.5 py-2 text-[13px]">
                <ModeIcon mode={p.mode} className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate tabular-nums">
                    {formatDate(p.paidOn)} · {MODE_LABEL[p.mode]}
                    {p.reference && <span className="text-muted-foreground"> · {p.reference}</span>}
                  </span>
                  {p.receiptId && (
                    <Link href={`/receipts/${p.receiptId}`} className="w-fit text-xs text-brand tabular-nums hover:underline dark:text-[#6da2ff]">
                      {p.receiptNumber}
                    </Link>
                  )}
                </span>
                <span className="grid text-right tabular-nums">
                  <span className="font-semibold">{formatINR(p.amount)}</span>
                  {p.tdsPaise > 0 && (
                    <span className="text-[11px] text-muted-foreground" title={tdsLabel(p.tdsSection)}>
                      + {formatINR(p.tdsPaise)} TDS
                    </span>
                  )}
                </span>
                <PaymentMenu payment={p} balanceAfterDelete={balance + p.amount + p.tdsPaise} onChanged={onChanged} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* credit notes against this invoice */}
      {(
        <div className="border-t px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Credit notes</span>
            <Link href={`/credit-notes/new?invoice=${encodeURIComponent(inv.id)}`} className="text-xs font-medium text-brand hover:underline dark:text-[#6da2ff]">
              Create credit note
            </Link>
          </div>
          {notes.length > 0 && (
            <ul className="mt-1.5 grid gap-1">
              {notes.map((n) => (
                <li key={n.id}>
                  <Link href={`/credit-notes/${n.id}`} className={cn("flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] transition-colors hover:bg-muted/50", n.status === "void" && "text-muted-foreground line-through")}>
                    <span className="font-medium tabular-nums">{n.number ?? "Draft"}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatDate(n.date)} · {reasonLabel(n.reason)}
                    </span>
                    <span className="ml-auto font-semibold tabular-nums">{formatINR(n.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows && (rows.length > 0 || credited > 0) && (
        <dl className="flex items-center justify-between gap-3 border-t bg-muted/30 px-3.5 py-2 text-[13px] tabular-nums">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Received</dt>
              <dd className="font-medium">{formatINR(rows.reduce((s, p) => s + p.amount, 0))}</dd>
            </div>
            {rows.some((p) => p.tdsPaise > 0) && (
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">TDS</dt>
                <dd className="font-medium">{formatINR(rows.reduce((s, p) => s + p.tdsPaise, 0))}</dd>
              </div>
            )}
            {credited > 0 && (
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Credits</dt>
                <dd className="font-medium">{formatINR(credited)}</dd>
              </div>
            )}
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Balance due</dt>
            <dd className={cn("font-semibold", overdue && "text-red-600 dark:text-red-400", balance === 0 && "text-emerald-700 dark:text-emerald-400")}>{balance === 0 ? "Paid in full" : formatINR(balance)}</dd>
          </div>
        </dl>
      )}

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} invoiceId={inv.id} onSaved={onChanged} />
    </section>
  )
}

type LinkedCreditNote = { id: string; number: string | null; date: string; reason: string; total: number; status: "draft" | "issued" | "void"; unapplied: number; refunded: number }
