"use client"

import * as React from "react"
import Link from "next/link"
import { DownloadIcon, LinkIcon, LoaderCircleIcon, MailIcon, MoreHorizontalIcon, PencilLineIcon, ReceiptTextIcon, Trash2Icon } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { PaymentResult, PaymentRow } from "@/lib/data/types"

import { DeletePaymentDialog, type DeletingPayment } from "./delete-dialog"
import { RecordPaymentDialog } from "./record-dialog"
import { useReceiptActions } from "./use-receipt-actions"

const item = "gap-2 py-1.5 text-[13px]"

/**
 * The ⋯ menu on a payment: edit, delete, and everything you do with its
 * receipt. `balanceAfterDelete` is known in an invoice's own list; elsewhere
 * the delete dialog looks it up.
 */
export function PaymentMenu({ payment, balanceAfterDelete, onChanged }: { payment: PaymentRow; balanceAfterDelete?: number; onChanged?: (r: PaymentResult) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [deleting, setDeleting] = React.useState<DeletingPayment | null>(null)
  const receipt = useReceiptActions()
  const rid = payment.receiptId
  const active = payment.receiptStatus === "active"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for payment of ${payment.amount / 100} on ${payment.paidOn}`} className="text-foreground/70" disabled={!!receipt.busy} />}>
          {receipt.busy ? <LoaderCircleIcon className="animate-spin" /> : <MoreHorizontalIcon />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 rounded-xl p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuItem className={item} onClick={() => setEditing(true)}>
              <PencilLineIcon /> Edit payment
            </DropdownMenuItem>
            {rid && (
              <DropdownMenuItem className={item} render={<Link href={`/receipts/${rid}`} />}>
                <ReceiptTextIcon /> View receipt
              </DropdownMenuItem>
            )}
            {rid && (
              <DropdownMenuItem className={item} render={<a href={`/api/receipts/${rid}/pdf`} download />}>
                <DownloadIcon /> Download receipt PDF
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {rid && active && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className={item} onClick={() => void receipt.whatsapp(rid)}>
                  <FaWhatsapp /> Share on WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem className={item} onClick={() => void receipt.copy(rid)}>
                  <LinkIcon /> Copy receipt link
                </DropdownMenuItem>
                <DropdownMenuItem className={item} onClick={() => void receipt.email(rid)}>
                  <MailIcon /> Email receipt
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className={item}
            onClick={() => setDeleting({ id: payment.id, amount: payment.amount, receiptNumber: payment.receiptNumber, invoiceId: payment.invoiceId, invoiceNumber: payment.invoiceNumber, balanceAfter: balanceAfterDelete })}
          >
            <Trash2Icon /> Delete payment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RecordPaymentDialog
        open={editing}
        onOpenChange={setEditing}
        invoiceId={payment.invoiceId}
        editing={{ id: payment.id, amount: payment.amount, paidOn: payment.paidOn, mode: payment.mode, reference: payment.reference, note: payment.note, receiptNumber: payment.receiptNumber, receiptRevision: payment.receiptRevision, receiptEmailedAt: payment.receiptEmailedAt }}
        onSaved={onChanged}
      />
      <DeletePaymentDialog payment={deleting} onOpenChange={(o) => !o && setDeleting(null)} onDeleted={onChanged} />
    </>
  )
}
