import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReceiptDocument } from "@/components/receipts/receipt-document"
import { signatureFontVars } from "@/lib/fonts"
import { takeReceiptJob } from "@/lib/server/store"

export const metadata: Metadata = { title: "Print · PrettyBills", robots: { index: false } }

/** Headless-browser target for receipt PDFs. Renders one receipt, nothing else. */
export default function PrintReceiptPage({ params }: PageProps<"/print/receipt/[token]">) {
  return (
    <Suspense fallback={null}>
      <PrintReceipt params={params} />
    </Suspense>
  )
}

async function PrintReceipt({ params }: { params: PageProps<"/print/receipt/[token]">["params"] }) {
  const { token } = await params
  const view = await takeReceiptJob(token)
  if (!view) notFound()
  return (
    <>
      <style>{`@page{margin:0}html,body{background:transparent!important;margin:0}`}</style>
      <div data-print-ready className={signatureFontVars} style={{ width: 794 }}>
        <ReceiptDocument view={view} print />
      </div>
    </>
  )
}
