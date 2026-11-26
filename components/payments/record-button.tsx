"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

import { RecordPaymentDialog } from "./record-dialog"

/** "+ Record payment": opens the dialog, with an invoice picker when no invoice is given. The action refreshes the page. */
export function RecordPaymentButton({ invoiceId, clientId, label = "Record payment", variant = "default", className }: { invoiceId?: string; clientId?: string; label?: string; variant?: "default" | "outline"; className?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant={variant} className={cn("h-8 gap-1.5 px-3 text-[13px]", className)} onClick={() => setOpen(true)}>
        <PlusIcon /> <span className="hidden sm:inline">{label}</span>
      </Button>
      <RecordPaymentDialog open={open} onOpenChange={setOpen} invoiceId={invoiceId} clientId={clientId} />
    </>
  )
}
