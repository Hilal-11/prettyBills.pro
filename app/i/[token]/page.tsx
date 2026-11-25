import { Suspense } from "react"
import type { Metadata } from "next"
import { DownloadIcon } from "lucide-react"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"
import { InvoiceDocument } from "@/components/landing/invoice-document"
import { signatureFontVars } from "@/lib/fonts"
import { Logo } from "@/components/landing/primitives"
import { ViewBeacon } from "@/components/public/view-beacon"
import { formatDate } from "@/lib/invoice/format"
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice/totals"
import { upiUri } from "@/lib/invoice/upi"
import { qrPath } from "@/lib/landing/qr"
import { sharedInvoice } from "@/lib/server/db/invoices"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Invoice · PrettyBills", robots: { index: false, follow: false } }

/** Public invoice page shared with the client: /i/<token>. */
export default function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className={`min-h-svh bg-muted/40 ${signatureFontVars}`}>
      <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading invoice…</div>}>
        <PublicInvoice params={params} />
      </Suspense>
    </div>
  )
}

async function PublicInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invoice = await sharedInvoice(await createClient(), token)
  if (!invoice) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <Logo />
        <h1 className="mt-8 text-xl font-semibold">This invoice link isn&apos;t available</h1>
        <p className="mt-2 text-sm text-muted-foreground">The sender may have turned it off. Ask them for a new link.</p>
      </div>
    )
  }

  const totals = computeInvoiceTotals(invoice)
  const qr = qrPath(upiUri(invoice, totals))
  const paid = invoice.status === "paid" || totals.balanceDue <= 0

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <ViewBeacon token={token} />
      <div className="overflow-hidden rounded-lg border bg-paper shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]">
        <InvoiceDocument invoice={invoice} fill />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-xl border bg-background p-5">
          <p className="text-[13px] text-muted-foreground">{invoice.from.name}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(paid ? totals.total : totals.balanceDue, { whole: true })}</p>
          <p className="text-[13px] text-muted-foreground">{paid ? "Paid · thank you" : `Due ${formatDate(invoice.dueDate, invoice.dateFormat)} · ${invoice.number}`}</p>
          <a href={`/api/public/${token}/pdf`} className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-9 w-full text-[13px]")}>
            <DownloadIcon /> Download PDF
          </a>
        </div>

        {!paid && invoice.payment.showUpiQr && invoice.payment.upiId && (
          <div className="rounded-xl border bg-background p-5 text-center">
            <p className="text-[13px] font-semibold">Scan to pay with any UPI app</p>
            <svg viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`} shapeRendering="crispEdges" className="mx-auto mt-3 size-44 rounded-md bg-white" role="img" aria-label="UPI payment QR code">
              <path d={qr.d} fill="#111" />
            </svg>
            <p className="mt-2 text-xs text-muted-foreground">{invoice.payment.upiId}</p>
            <a href={upiUri(invoice, totals)} className={cn(buttonVariants(), "mt-4 h-9 w-full text-[13px] lg:hidden")}>
              Open UPI app
            </a>
          </div>
        )}

        <p className="px-1 text-center text-xs text-muted-foreground">
          Sent with <span className="font-semibold text-foreground">PrettyBills</span>
        </p>
      </aside>
    </div>
  )
}
