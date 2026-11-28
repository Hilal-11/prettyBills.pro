import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlarmClockIcon, HistoryIcon } from "lucide-react"

import { PageShell } from "@/components/app/page-shell"
import { EmptyState, MissingState } from "@/components/app/states"
import { InvoiceDocument } from "@/components/landing/invoice-document"
import { QuotePanel } from "@/components/quotes/quote-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { quoteLabel } from "@/lib/billing/quotes"
import { signatureFontVars } from "@/lib/fonts"
import { getQuote, getRevision, type QuoteDetail } from "@/lib/server/db/quotes"
import { dbMessage } from "@/lib/server/db/util"
import { actionOrigins } from "@/lib/server/http"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Quote" }

/** One quote or proforma, read-only: the preview beside its side panel. ?rev=N shows an older revision. Drafts open in the editor. */
export default function QuotePage({ params, searchParams }: PageProps<"/quotes/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Body({ params, searchParams }: { params: PageProps<"/quotes/[id]">["params"]; searchParams: PageProps<"/quotes/[id]">["searchParams"] }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(`/quotes/${id}`)}`)
  const crumbs = [{ label: "Quotes & proforma", href: "/quotes" }, { label: "Quote" }]

  let quote: QuoteDetail | null
  try {
    quote = await getQuote(session.db, id)
  } catch (error) {
    return (
      <PageShell crumbs={crumbs}>
        <EmptyState icon={AlarmClockIcon} title="Couldn't load this quote" body={dbMessage(error)} />
      </PageShell>
    )
  }
  if (!quote)
    return (
      <PageShell crumbs={crumbs}>
        <MissingState title="We couldn't find that quote" body="It may belong to a different account. Check you're logged in as the right person." back={{ label: "Back to quotes", href: "/quotes" }} />
      </PageShell>
    )
  const rev = Number(sp.rev)
  const viewing = Number.isInteger(rev) && rev >= 1 && rev < quote.revision && quote.revisions.some((r) => r.revision === rev) ? rev : null
  if (quote.status === "draft" && viewing === null) redirect(`/quotes/${id}/edit`)

  const snapshot = viewing ? await getRevision(session.db, id, viewing) : null
  const doc = snapshot ? { ...snapshot, number: quote.number, revision: viewing!, status: "draft" as const, quote: { ...(snapshot.quote ?? quote.document.quote!), kind: quote.kind } } : quote.document
  const { publicOrigin } = await actionOrigins()
  const listHref = quote.kind === "proforma" ? "/quotes?kind=proforma" : "/quotes"

  return (
    <PageShell crumbs={[{ label: quote.kind === "proforma" ? "Proforma" : "Quotes", href: listHref }, { label: quoteLabel(quote.number, viewing ?? quote.revision) }]} bleed>
      <div className={`min-h-0 flex-1 overflow-y-auto lg:flex lg:overflow-hidden ${signatureFontVars}`}>
        <div className="min-w-0 bg-muted/40 p-4 sm:p-6 lg:flex-1 lg:overflow-y-auto dark:bg-black/25">
          {viewing && (
            <div role="status" className="mx-auto mb-3 flex max-w-[760px] items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs">
              <HistoryIcon className="size-3.5 text-muted-foreground" />
              <span className="flex-1">
                Revision {viewing}, read-only. This is what the client saw before revision {viewing + 1}.
              </span>
              <Link href={`/quotes/${id}`} className="font-medium text-brand hover:underline dark:text-[#6da2ff]">
                Back to latest
              </Link>
            </div>
          )}
          <div className="mx-auto max-w-[760px] overflow-hidden rounded-[4px] shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_24px_48px_-24px_rgb(0_0_0/0.35)]">
            <InvoiceDocument invoice={doc} fill />
          </div>
        </div>
        <aside aria-label="Quote details" className="border-t lg:w-[360px] lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <QuotePanel quote={quote} viewingRevision={viewing} publicUrl={quote.publicToken && quote.linkActive && quote.status !== "void" ? `${publicOrigin}/q/${quote.publicToken}` : null} />
        </aside>
      </div>
    </PageShell>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Loading quote">
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 bg-muted/40 p-6">
          <Skeleton className="mx-auto aspect-[1/1.414] max-w-[760px] rounded-[4px]" />
        </div>
        <div className="hidden w-[360px] gap-3 border-l p-4 lg:grid lg:content-start">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  )
}
