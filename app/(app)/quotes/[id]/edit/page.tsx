import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { InvoiceWorkspace } from "@/components/invoice-editor/workspace"
import { WorkspaceSkeleton } from "@/components/invoice-editor/workspace-skeleton"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Edit quote" }

/** A saved quote or proforma in the invoice editor. Sent ones open read-only until revised. */
export default function EditQuotePage({ params }: PageProps<"/quotes/[id]/edit">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <EditQuote params={params} />
    </Suspense>
  )
}

async function EditQuote({ params }: { params: PageProps<"/quotes/[id]/edit">["params"] }) {
  const { id } = await params
  if (!(await getSession())) redirect(`/login?next=${encodeURIComponent(`/quotes/${id}/edit`)}`)
  return <InvoiceWorkspace key={id} quoteId={id} />
}
