import type { Metadata } from "next"

import { InvoicesPage } from "@/components/app/invoices-page"

export const metadata: Metadata = { title: "Paid invoices" }

export default function PaidInvoicesPage({ searchParams }: PageProps<"/invoices/paid">) {
  return <InvoicesPage view="paid" searchParams={searchParams} />
}
