import type { Metadata } from "next"

import { InvoicesPage } from "@/components/app/invoices-page"

export const metadata: Metadata = { title: "Drafts" }

export default function DraftsInvoicesPage({ searchParams }: PageProps<"/invoices/drafts">) {
  return <InvoicesPage view="draft" searchParams={searchParams} />
}
