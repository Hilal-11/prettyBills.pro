"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"

import { cancelInvoiceAction } from "@/app/(app)/credit-notes/actions"
import { DateField, Field } from "@/components/invoice-editor/fields"
import { useToast } from "@/components/invoice-editor/toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { todayIST } from "@/lib/billing/dates"
import { formatINR } from "@/lib/billing/money"
import { invoicesChanged } from "@/lib/client/workspace"

/**
 * "Cancel invoice": the GST way to undo a sent invoice. Issues a credit note
 * for everything still uncredited, reason "Cancellation of invoice". Money
 * already received becomes credit for the client (refund it or apply it).
 */
export function CancelInvoiceDialog({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (o: boolean) => void; invoice: { id: string; number: string; total: number; amountPaid: number; issueDate: string } }) {
  const router = useRouter()
  const toast = useToast()
  const today = React.useMemo(() => todayIST(), [])
  const [reason, setReason] = React.useState("")
  const [date, setDate] = React.useState(today)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [key] = React.useState(() => crypto.randomUUID())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Cancel {invoice.number}?</DialogTitle>
          <DialogDescription>
            A credit note is issued for everything still uncredited on it, so it reads Cancelled and its balance becomes ₹0. The invoice keeps its number, as GST requires.
            {invoice.amountPaid > 0 && ` The ${formatINR(invoice.amountPaid)} already received becomes credit for the client: refund it or apply it to another invoice.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="Reason" htmlFor="cancel-reason" help="Printed on the credit note.">
            <Input id="cancel-reason" maxLength={300} placeholder="e.g. Order cancelled by client" value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 text-sm md:text-sm" />
          </Field>
          <Field label="Date" htmlFor="cancel-date">
            <DateField id="cancel-date" field="cancel-date" value={date} min={invoice.issueDate} max={today} onChange={setDate} />
          </Field>
        </div>
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" className="h-8 text-[13px]" onClick={() => onOpenChange(false)}>
            Keep invoice
          </Button>
          <Button
            variant="destructive"
            className="h-8 text-[13px]"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              const r = await cancelInvoiceAction(invoice.id, reason, date, key).catch(() => ({ ok: false as const, error: "You seem to be offline. Nothing changed." }))
              setBusy(false)
              if (!r.ok) return setError(r.error)
              onOpenChange(false)
              invoicesChanged()
              toast({
                title: `${invoice.number} cancelled · ${r.number}`,
                description: r.unapplied > 0 ? `${formatINR(r.unapplied)} is left as client credit.` : undefined,
                tone: "success",
                duration: 6000,
                action: { label: "View credit note", onClick: () => router.push(`/credit-notes/${r.id}`) },
              })
              router.refresh()
            }}
          >
            {busy && <LoaderCircleIcon className="animate-spin" />} Cancel invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
