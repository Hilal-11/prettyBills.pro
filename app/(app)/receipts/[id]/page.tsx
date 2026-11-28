import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRightIcon } from "lucide-react"

import { PageShell } from "@/components/app/page-shell"
import { MissingState } from "@/components/app/states"
import { Timeline } from "@/components/payments/timeline"
import { ReceiptActions } from "@/components/receipts/receipt-actions"
import { ReceiptDocument } from "@/components/receipts/receipt-document"
import { ReceiptStatus } from "@/components/receipts/receipts-table"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, nowMs } from "@/lib/billing/dates"
import { MODE_LABEL } from "@/lib/billing/modes"
import { formatINR } from "@/lib/billing/money"
import { signatureFontVars } from "@/lib/fonts"
import { getReceiptView, listActivity } from "@/lib/server/db/payments"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Receipt" }

export default function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  return (
    <Suspense fallback={<ReceiptSkeleton />}>
      <Receipt params={params} />
    </Suspense>
  )
}

async function Receipt({ params }: { params: PageProps<"/receipts/[id]">["params"] }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(`/receipts/${id}`)}`)
  const view = await getReceiptView(session.db, id).catch(() => null)
  const crumbs = [{ label: "Receipts", href: "/receipts" }, { label: view?.receipt.number ?? "Receipt" }]
  if (!view) {
    return (
      <PageShell crumbs={crumbs}>
        <MissingState title="We couldn't find that receipt" body="It may belong to a different account. Check you're logged in as the right person." back={{ label: "Back to receipts", href: "/receipts" }} />
      </PageShell>
    )
  }
  const activity = await listActivity(session.db, { receiptId: id }, session.userId).catch(() => [])
  const { receipt, payment, invoice, balance } = view
  const now = nowMs()

  return (
    <PageShell crumbs={crumbs} wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`overflow-hidden rounded-lg border bg-paper shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)] ${signatureFontVars}`}>
          <ReceiptDocument view={view} fill invoiceHref={`/invoices/${invoice.id}`} />
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-0">
          <section className="rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-[15px] font-semibold tabular-nums">{receipt.number}</h1>
                <p className="text-xs text-muted-foreground">
                  {formatDate(receipt.date)}
                  {receipt.revision > 1 && ` · Revision ${receipt.revision}`}
                </p>
              </div>
              <ReceiptStatus status={receipt.status} />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{formatINR(payment.amount)}</p>
            <p className="text-[13px] text-muted-foreground">{balance.paidInFull ? "Paid in full" : `${formatINR(balance.remaining)} still due after this`}</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-3 text-[13px]">
              <dt className="text-muted-foreground">Mode</dt>
              <dd>{MODE_LABEL[payment.mode]}</dd>
              {payment.reference && (
                <>
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="truncate tabular-nums">{payment.reference}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Paid on</dt>
              <dd>{formatDate(payment.paidOn)}</dd>
              <dt className="text-muted-foreground">Invoice</dt>
              <dd>
                <Link href={`/invoices/${invoice.id}`} className="inline-flex items-center gap-0.5 font-medium text-brand hover:underline dark:text-[#6da2ff]">
                  {invoice.number} <ArrowUpRightIcon className="size-3" />
                </Link>
              </dd>
              <dt className="text-muted-foreground">Client</dt>
              <dd className="truncate">{invoice.clientId ? <Link href={`/clients/${invoice.clientId}`} className="hover:underline">{invoice.billTo.name}</Link> : invoice.billTo.name || "—"}</dd>
              {receipt.emailedAt && (
                <>
                  <dt className="text-muted-foreground">Emailed</dt>
                  <dd>{formatDate(receipt.emailedAt.slice(0, 10))}</dd>
                </>
              )}
              {payment.note && (
                <>
                  <dt className="text-muted-foreground">Note</dt>
                  <dd className="whitespace-pre-line text-foreground/85">{payment.note}</dd>
                </>
              )}
            </dl>
            {receipt.status === "void" && receipt.voidReason && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Voided: {receipt.voidReason}</p>}
          </section>

          <ReceiptActions
            receiptId={receipt.id}
            invoiceId={invoice.id}
            invoiceNumber={invoice.number}
            active={receipt.status === "active"}
            payment={{ id: payment.id, amount: payment.amount, tdsPaise: payment.tdsPaise, tdsSection: payment.tdsSection, tdsRateBp: null, paidOn: payment.paidOn, mode: payment.mode, reference: payment.reference, note: payment.note ?? null, receiptNumber: receipt.number, receiptRevision: receipt.revision, receiptEmailedAt: receipt.emailedAt ?? null }}
          />

          <section className="overflow-hidden rounded-xl border bg-background">
            <h2 className="border-b px-4 py-2.5 text-[13px] font-semibold">Activity</h2>
            <Timeline items={activity} now={now} />
          </section>
        </aside>
      </div>
    </PageShell>
  )
}

function ReceiptSkeleton() {
  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
      <Skeleton className="aspect-[1/1.414] rounded-lg" />
      <div className="grid content-start gap-4">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  )
}
