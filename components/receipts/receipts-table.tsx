"use client"

import * as React from "react"
import Link from "next/link"
import { DownloadIcon, EyeIcon, LinkIcon, LoaderCircleIcon, MailIcon, MoreHorizontalIcon } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { useReceiptActions } from "@/components/payments/use-receipt-actions"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ReceiptRow } from "@/lib/data/types"

const item = "gap-2 py-1.5 text-[13px]"

export function ReceiptStatus({ status, className }: { status: "active" | "void"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/85", status === "void" && "text-muted-foreground line-through", className)}>
      <span className={cn("size-1.5 rounded-full", status === "void" ? "bg-zinc-400" : "bg-emerald-500")} />
      {status === "void" ? "Void" : "Active"}
    </span>
  )
}

export function ReceiptMenu({ receipt }: { receipt: ReceiptRow }) {
  const a = useReceiptActions()
  const active = receipt.status === "active"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for receipt ${receipt.number}`} className="text-foreground/70" disabled={!!a.busy} />}>
        {a.busy ? <LoaderCircleIcon className="animate-spin" /> : <MoreHorizontalIcon />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuItem className={item} render={<Link href={`/receipts/${receipt.id}`} />}>
            <EyeIcon /> View
          </DropdownMenuItem>
          <DropdownMenuItem className={item} render={<a href={`/api/receipts/${receipt.id}/pdf`} download />}>
            <DownloadIcon /> Download PDF
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className={item} onClick={() => void a.whatsapp(receipt.id)}>
                <FaWhatsapp /> Share on WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onClick={() => void a.email(receipt.id)}>
                <MailIcon /> Email
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onClick={() => void a.copy(receipt.id)}>
                <LinkIcon /> Copy link
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
