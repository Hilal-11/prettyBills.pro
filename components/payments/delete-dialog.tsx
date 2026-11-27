"use client"

import * as React from "react"
import { LoaderIcon } from "lucide-react"

import { deletePaymentAction, paymentContextAction } from "@/app/(app)/payments/actions"
import { Field } from "@/components/invoice-editor/fields"
import { useToast } from "@/components/invoice-editor/toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { formatINR } from "@/lib/billing/money"
import { invoicesChanged } from "@/lib/client/workspace"
import type { PaymentResult } from "@/lib/data/types"

import { Notice } from "./record-dialog"

/** `balanceAfter` when the caller knows it; otherwise it's looked up when the dialog opens. */
export type DeletingPayment = { id: string; amount: number; receiptNumber: string | null; invoiceId: string; invoiceNumber: string; balanceAfter?: number }

/** Deleting keeps the payment on record (marked deleted) and voids its receipt. A reason is required. */
export function DeletePaymentDialog({ payment, onOpenChange, onDeleted }: { payment: DeletingPayment | null; onOpenChange: (open: boolean) => void; onDeleted?: (r: PaymentResult) => void }) {
  const toast = useToast()
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [last, setLast] = React.useState<string | null>(null)
  const [looked, setLooked] = React.useState<number | null>(null)
  if ((payment?.id ?? null) !== last) {
    setLast(payment?.id ?? null)
    setReason("")
    setError(null)
    setLooked(null)
  }
  React.useEffect(() => {
    if (!payment || payment.balanceAfter != null) return
    let live = true
    paymentContextAction(payment.invoiceId)
      .then((r) => live && r.ok && setLooked(r.invoice.balanceDue + payment.amount))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [payment])
  const balanceAfter = payment?.balanceAfter ?? looked
  const short = reason.trim().length < 3

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    if (!payment || short || busy) return
    setBusy(true)
    const r = await deletePaymentAction({ paymentId: payment.id, reason }).catch(() => ({ ok: false as const, error: "You seem to be offline. Nothing was deleted." }))
    setBusy(false)
    if (!r.ok) return setError(r.error)
    invoicesChanged()
    onDeleted?.(r.result)
    onOpenChange(false)
    toast({ title: `Payment deleted · Receipt ${r.result.receipt.number} voided`, description: `${r.result.invoice.number} balance is now ${formatINR(r.result.invoice.balanceDue)}.`, tone: "success", duration: 5000 })
  }

  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={confirm} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Delete payment of {payment ? formatINR(payment.amount) : ""}?</DialogTitle>
            <DialogDescription>
              {payment?.receiptNumber ? `Receipt ${payment.receiptNumber} will be voided and ` : ""}
              the balance on {payment?.invoiceNumber} {balanceAfter != null ? `becomes ${formatINR(balanceAfter)}` : `goes up by ${payment ? formatINR(payment.amount) : ""}`}. The payment stays on record as deleted, and its receipt number isn&apos;t reused.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason" required htmlFor="delete-reason" help="For example: entered twice, cheque bounced." error={error ?? undefined}>
            <Textarea id="delete-reason" autoFocus rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-14 text-sm md:text-sm" />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-8 text-[13px]" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" className="h-8 text-[13px]" disabled={short || busy}>
              {busy && <LoaderIcon className="animate-spin" />}
              Delete payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
