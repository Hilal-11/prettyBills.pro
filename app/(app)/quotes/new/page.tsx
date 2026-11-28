import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { InvoiceWorkspace } from "@/components/invoice-editor/workspace"
import { WorkspaceSkeleton } from "@/components/invoice-editor/workspace-skeleton"
import { getQuoteSettings, DEFAULT_QUOTE_SETTINGS } from "@/lib/server/db/quotes"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "New quote" }

/**
 * A new quote (?kind=quote) or proforma (?kind=proforma), in the invoice
 * editor. ?client=<id> and ?template=<slug> start it with those picked. The
 * number comes from the QT / PI series on the first save, when the address
 * becomes /quotes/<id>/edit.
 */
export default function NewQuotePage({ searchParams }: PageProps<"/quotes/new">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <NewQuote searchParams={searchParams} />
    </Suspense>
  )
}

async function NewQuote({ searchParams }: { searchParams: PageProps<"/quotes/new">["searchParams"] }) {
  const sp = await searchParams
  const session = await getSession()
  const kind = sp.kind === "proforma" ? "proforma" : "quote"
  if (!session) redirect(`/login?next=${encodeURIComponent(`/quotes/new?kind=${kind}`)}`)
  const one = (v: string | string[] | undefined) => (typeof v === "string" && /^[\w-]{1,64}$/.test(v) ? v : undefined)
  const settings = await getQuoteSettings(session.db).catch(() => DEFAULT_QUOTE_SETTINGS)
  return (
    <InvoiceWorkspace
      key={`${kind}:${one(sp.client) ?? ""}:${one(sp.template) ?? ""}:${one(sp.n) ?? ""}`}
      kind={kind}
      clientId={one(sp.client)}
      templateId={one(sp.template)}
      quoteDefaults={{ title: settings.title, validityDays: settings.validityDays }}
    />
  )
}
