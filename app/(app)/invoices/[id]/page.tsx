import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { InvoiceWorkspace } from "@/components/invoice-editor/workspace"
import { WorkspaceSkeleton } from "@/components/invoice-editor/workspace-skeleton"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Invoice" }

/** One saved invoice, open in the editor. Saved invoices need an account. */
export default function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <OpenInvoice params={params} />
    </Suspense>
  )
}

async function OpenInvoice({ params }: { params: PageProps<"/invoices/[id]">["params"] }) {
  const { id } = await params
  if (!(await getSession())) redirect(`/login?next=${encodeURIComponent(`/invoices/${id}`)}`)
  return <InvoiceWorkspace key={id} invoiceId={id} />
}
