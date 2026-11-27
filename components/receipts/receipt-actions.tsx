"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DownloadIcon, LinkIcon, LoaderCircleIcon, MailIcon, PencilLineIcon, Trash2Icon } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { DeletePaymentDialog, type DeletingPayment } from "@/components/payments/delete-dialog"
import { RecordPaymentDialog, type EditingPayment } from "@/components/payments/record-dialog"
import { useReceiptActions } from "@/components/payments/use-receipt-actions"
import { Button, buttonVariants } from "@/components/ui/button"

/** The receipt page's buttons: download, share, email, and edit or delete its payment. */
export function ReceiptActions({ receiptId, invoiceId, invoiceNumber, active, payment }: { receiptId: string; invoiceId: string; invoiceNumber: string; active: boolean; payment: EditingPayment }) {
  const a = useReceiptActions()
  const router = useRouter()
  const [editing, setEditing] = React.useState(false)
  const [deleting, setDeleting] = React.useState<DeletingPayment | null>(null)
  const spin = (k: string, icon: React.ReactNode) => (a.busy === k ? <LoaderCircleIcon className="animate-spin" /> : icon)
  const btn = "h-9 w-full justify-start gap-2 text-[13px]"

  return (
    <div className="grid gap-2">
      <a href={`/api/receipts/${receiptId}/pdf`} download className={cn(buttonVariants(), btn)}>
        <DownloadIcon /> Download PDF
      </a>
      {active && (
        <>
          <Button variant="outline" className={btn} disabled={!!a.busy} onClick={() => void a.whatsapp(receiptId)}>
            {spin("wa", <FaWhatsapp className="text-emerald-600 dark:text-emerald-400" />)} Share on WhatsApp
          </Button>
          <Button variant="outline" className={btn} disabled={!!a.busy} onClick={() => void a.email(receiptId)}>
            {spin("email", <MailIcon />)} Email receipt
          </Button>
          <Button variant="outline" className={btn} disabled={!!a.busy} onClick={() => void a.copy(receiptId)}>
            {spin("copy", <LinkIcon />)} Copy link
          </Button>
          <div className="mt-1 grid grid-cols-2 gap-2 border-t pt-3">
            <Button variant="outline" className="h-8 gap-1.5 text-[13px]" onClick={() => setEditing(true)}>
              <PencilLineIcon /> Edit payment
            </Button>
            <Button variant="outline" className="h-8 gap-1.5 text-[13px] text-destructive hover:text-destructive" onClick={() => setDeleting({ id: payment.id, amount: payment.amount, receiptNumber: payment.receiptNumber, invoiceId, invoiceNumber })}>
              <Trash2Icon /> Delete
            </Button>
          </div>
        </>
      )}
      <RecordPaymentDialog open={editing} onOpenChange={setEditing} invoiceId={invoiceId} editing={payment} />
      <DeletePaymentDialog payment={deleting} onOpenChange={(o) => !o && setDeleting(null)} onDeleted={() => router.refresh()} />
    </div>
  )
}
