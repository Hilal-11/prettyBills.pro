import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DownloadIcon, FileTextIcon } from "lucide-react"
import { cn } from "cn"

import { Logo } from "@/components/landing/primitives"
import { ReceiptDocument } from "@/components/receipts/receipt-document"
import { buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/billing/dates"
import { formatINR } from "@/lib/billing/money"
import { signatureFontVars } from "@/lib/fonts"
import { sharedReceipt } from "@/lib/server/db/payments"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Receipt · PrettyBills", robots: { index: false, follow: false } }

/** Public receipt shared with the client: /r/<token>. Gone (404) once the receipt is voided. */
export default function PublicReceiptPage({ params }: PageProps<"/r/[token]">) {
  return (
    <div className={`min-h-svh bg-muted/40 ${signatureFontVars}`}>
      <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading receipt…</div>}>
        <PublicReceipt params={params} />
      </Suspense>
    </div>
  )
}

async function PublicReceipt({ params }: { params: PageProps<"/r/[token]">["params"] }) {
  const { token } = await params
  const view = await sharedReceipt(await createClient(), token)
  if (!view) notFound()
  const { receipt, payment, invoice, balance } = view
  const invoiceHref = view.invoiceLink ? `/i/${view.invoiceLink}` : null

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <div className="overflow-hidden rounded-lg border bg-paper shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]">
        <ReceiptDocument view={view} fill invoiceHref={invoiceHref} />
      </div>
      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-xl border bg-background p-5">
          <p className="text-[13px] text-muted-foreground">{invoice.from.name}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatINR(payment.amount)}</p>
          <p className="text-[13px] text-muted-foreground">
            Received {formatDate(payment.paidOn)} · {receipt.number}
          </p>
          <p className={cn("mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", balance.paidInFull ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-brand/10 text-brand dark:text-[#6da2ff]")}>
            {balance.paidInFull ? "Paid in full" : `${formatINR(balance.remaining)} still due on ${invoice.number}`}
          </p>
          <a href={`/api/public/receipt/${token}/pdf`} className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-9 w-full text-[13px]")}>
            <DownloadIcon /> Download PDF
          </a>
          {invoiceHref && (
            <Link href={invoiceHref} className={cn(buttonVariants({ variant: "ghost" }), "mt-2 h-9 w-full text-[13px]")}>
              <FileTextIcon /> View invoice {invoice.number}
            </Link>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 px-1 text-center text-xs text-muted-foreground">
          <Logo />
          <span>Receipts made with PrettyBills, free GST invoices</span>
        </div>
      </aside>
    </div>
  )
}
