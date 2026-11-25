import type { Metadata } from "next"

import { InvoicesPage } from "@/components/app/invoices-page"

export const metadata: Metadata = { title: "Awaiting payment" }

export default function SentInvoicesPage({ searchParams }: PageProps<"/invoices/sent">) {
  return <InvoicesPage view="sent" searchParams={searchParams} />
}
