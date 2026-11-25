import type { Metadata } from "next"

import { InvoicesPage } from "@/components/app/invoices-page"

export const metadata: Metadata = { title: "Invoices" }

export default function AllInvoicesPage({ searchParams }: PageProps<"/invoices">) {
  return <InvoicesPage view="all" searchParams={searchParams} />
}
