import { Suspense } from "react"
import type { Metadata } from "next"

import { InvoiceWorkspace } from "@/components/invoice-editor/workspace"
import { WorkspaceSkeleton } from "@/components/invoice-editor/workspace-skeleton"

export const metadata: Metadata = { title: "New invoice" }

/**
 * A new invoice. ?template=<slug> and ?client=<id> start it with a template or
 * client picked (from /templates and /clients). Once it's first saved, the
 * address becomes /invoices/<id>.
 */
export default function CreatePage({ searchParams }: PageProps<"/create">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <NewInvoice searchParams={searchParams} />
    </Suspense>
  )
}

async function NewInvoice({ searchParams }: { searchParams: PageProps<"/create">["searchParams"] }) {
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (typeof v === "string" && /^[\w-]{1,64}$/.test(v) ? v : undefined)
  const templateId = one(sp.template)
  const clientId = one(sp.client)
  // a new key per request, so "New invoice" from /create still starts fresh
  return <InvoiceWorkspace key={`${templateId ?? ""}:${clientId ?? ""}:${one(sp.n) ?? ""}`} templateId={templateId} clientId={clientId} />
}
