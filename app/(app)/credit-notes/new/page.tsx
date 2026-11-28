import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlarmClockIcon, FileMinusIcon } from "lucide-react"

import { PageShell } from "@/components/app/page-shell"
import { EmptyState, MissingState } from "@/components/app/states"
import { CreditNoteEditor } from "@/components/credit-notes/credit-note-editor"
import { ClientChip } from "@/components/invoices/client-chip"
import { Skeleton } from "@/components/ui/skeleton"
import { creditableLines, invoiceRates } from "@/lib/billing/credit-notes"
import { formatDate } from "@/lib/billing/dates"
import { formatINR } from "@/lib/billing/money"
import { creditContext } from "@/lib/server/db/credit-notes"
import { dbMessage } from "@/lib/server/db/util"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "New credit note" }

/** /credit-notes/new?invoice=<id> opens the editor; without one, pick the invoice first. */
export default function NewCreditNotePage({ searchParams }: PageProps<"/credit-notes/new">) {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-96 rounded-xl" />}>
      <Body searchParams={searchParams} />
    </Suspense>
  )
}

async function Body({ searchParams }: { searchParams: PageProps<"/credit-notes/new">["searchParams"] }) {
  const session = await getSession()
  if (!session) redirect("/login?next=/credit-notes/new")
  const sp = await searchParams
  const invoiceId = typeof sp.invoice === "string" && /^[\w-]{1,96}$/.test(sp.invoice) ? sp.invoice : null
  if (!invoiceId) return <Picker />

  let ctx: Awaited<ReturnType<typeof creditContext>>
  try {
    ctx = await creditContext(session.db, invoiceId)
  } catch (error) {
    return (
      <PageShell crumbs={[{ label: "Credit notes", href: "/credit-notes" }, { label: "New" }]}>
        <EmptyState icon={AlarmClockIcon} title="Couldn't open this invoice" body={dbMessage(error)} />
      </PageShell>
    )
  }
  if (!ctx) return <MissingInvoice />
  if (ctx.summary.status === "draft" || ctx.summary.status === "void")
    return (
      <PageShell crumbs={[{ label: "Credit notes", href: "/credit-notes" }, { label: "New" }]}>
        <EmptyState icon={FileMinusIcon} title={ctx.summary.status === "draft" ? "This invoice hasn't been sent" : "This invoice is void"} body={ctx.summary.status === "draft" ? "Credit notes are for sent invoices. Edit the draft instead." : "A void invoice can't be credited."} action={{ label: "Back to the invoice", href: `/invoices/${invoiceId}` }} />
      </PageShell>
    )
  return <CreditNoteEditor invoice={ctx.invoice} summary={ctx.summary} prior={ctx.prior} lines={creditableLines(ctx.invoice, ctx.prior)} rates={invoiceRates(ctx.invoice)} />
}

function MissingInvoice() {
  return (
    <PageShell crumbs={[{ label: "Credit notes", href: "/credit-notes" }, { label: "New" }]}>
      <MissingState title="We couldn't find that invoice" body="It may have been deleted, or it belongs to a different account." back={{ label: "Pick an invoice", href: "/credit-notes/new" }} />
    </PageShell>
  )
}

/** Sent, non-void invoices to credit, newest first. */
async function Picker() {
  const session = (await getSession())!
  const { data, error } = await session.db
    .from("invoices")
    .select("id, number, client_name, issue_date, total, balance_due, credited_paise, status, cancelled")
    .not("status", "in", "(draft,void)")
    .eq("cancelled", false)
    .order("issue_date", { ascending: false })
    .limit(200)
  const rows = (data ?? []) as { id: string; number: string; client_name: string | null; issue_date: string; total: number; balance_due: number; credited_paise: number; status: string }[]
  return (
    <PageShell crumbs={[{ label: "Credit notes", href: "/credit-notes" }, { label: "New" }]}>
      <div className="mx-auto grid max-w-2xl gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Which invoice is this credit note for?</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">A credit note always references one sent invoice, with the same client and tax.</p>
        </div>
        {error ? (
          <EmptyState icon={AlarmClockIcon} title="Couldn't load invoices" body={dbMessage(error)} />
        ) : rows.length ? (
          <ul className="divide-y overflow-hidden rounded-xl border bg-background">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/credit-notes/new?invoice=${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/40">
                  <ClientChip name={r.client_name ?? ""} />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium tabular-nums">{r.number}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.client_name || "No client"} · {formatDate(r.issue_date)}
                      {Number(r.credited_paise) > 0 ? ` · ${formatINR(Number(r.credited_paise))} credited` : ""}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-semibold">{formatINR(Number(r.total))}</span>
                    <span className="block text-xs text-muted-foreground">{Number(r.balance_due) ? `${formatINR(Number(r.balance_due))} due` : "Settled"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileMinusIcon} title="No sent invoices yet" body="Credit notes reduce or cancel invoices you've already sent." action={{ label: "Go to invoices", href: "/invoices" }} />
        )}
      </div>
    </PageShell>
  )
}
