import type { Metadata } from "next"

import { InvoicesPage } from "@/components/app/invoices-page"

export const metadata: Metadata = { title: "Overdue" }

export default function OverdueInvoicesPage({ searchParams }: PageProps<"/invoices/overdue">) {
  return <InvoicesPage view="overdue" searchParams={searchParams} />
}
