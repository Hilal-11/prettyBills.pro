import { Suspense } from "react"
import type { Metadata } from "next"
import { AlertTriangleIcon, DownloadIcon, PencilLineIcon } from "lucide-react"
import { cn } from "cn"

import { Logo } from "@/components/landing/primitives"
import { InvoiceDocument } from "@/components/landing/invoice-document"
import { ViewBeacon } from "@/components/public/view-beacon"
import { QuoteRespond } from "@/components/quotes/quote-respond"
import { buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/billing/dates"
import { documentTitle, quoteLabel } from "@/lib/billing/quotes"
import { signatureFontVars } from "@/lib/fonts"
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice/totals"
import { sharedQuote } from "@/lib/server/db/quotes"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Quotation · PrettyBills", robots: { index: false, follow: false } }

/** The quote or proforma a client was sent: /q/<token>. They can download it, and accept (or decline) it here. */
export default function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className={`min-h-svh bg-muted/40 ${signatureFontVars}`}>
      <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>}>
        <PublicQuote params={params} />
      </Suspense>
    </div>
  )
}

async function PublicQuote({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const shared = await sharedQuote(await createClient(), token)
  if (!shared) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <Logo />
        <h1 className="mt-8 text-xl font-semibold">This link isn&apos;t available</h1>
        <p className="mt-2 text-sm text-muted-foreground">The sender may have turned it off or withdrawn the quote. Ask them for a new link.</p>
      </div>
    )
  }

  const doc = shared.document
  const total = computeInvoiceTotals(doc).total
  const title = documentTitle(doc)
  const answered = shared.response && shared.response.by === "client" ? { status: shared.response.action, name: shared.response.name, comment: shared.response.comment, at: shared.response.at } : null
  const canRespond = shared.status === "sent"

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <ViewBeacon token={token} path={`/api/public/quote/${token}/view`} />
      <div className="grid content-start gap-3">
        {shared.expired && canRespond && (
          <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-900 dark:text-amber-200">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            This quote expired on {formatDate(shared.validUntil)}. You can still accept it, and the business will confirm.
          </p>
        )}
        {shared.status === "revising" && (
          <p role="status" className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2 text-[13px]">
            <PencilLineIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {doc.from.name} is updating this {shared.kind === "proforma" ? "proforma" : "quote"}. You&apos;ll get the new version soon.
          </p>
        )}
        <div className="overflow-hidden rounded-lg border bg-paper shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]">
          <InvoiceDocument invoice={doc} fill />
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-xl border bg-background p-5">
          <p className="text-[13px] text-muted-foreground">{doc.from.name}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(total, { whole: true })}</p>
          <p className="text-[13px] text-muted-foreground">
            {title} {quoteLabel(shared.number, shared.revision)}
            {shared.validUntil ? ` · valid until ${formatDate(shared.validUntil)}` : ""}
          </p>
          <a href={`/api/public/quote/${token}/pdf`} className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-9 w-full text-[13px]")}>
            <DownloadIcon /> Download PDF
          </a>
        </div>

        {(canRespond || answered) && <QuoteRespond token={token} kind={shared.kind} clientName={doc.billTo.name} business={doc.from.name || "The business"} initial={answered} />}
        {!canRespond && !answered && shared.status === "converted" && <p className="rounded-xl border bg-background p-4 text-[13px] text-muted-foreground">This has been accepted and turned into an invoice.</p>}

        <p className="px-1 text-center text-xs text-muted-foreground">
          Sent with <span className="font-semibold text-foreground">PrettyBills</span> · {shared.kind === "proforma" ? "A proforma is not a tax invoice." : "A quotation is not a tax invoice."}
        </p>
      </aside>
    </div>
  )
}
