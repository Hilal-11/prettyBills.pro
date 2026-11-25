import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { InvoiceDocument } from "@/components/landing/invoice-document"
import { signatureFontVars } from "@/lib/fonts"
import { templateMeta } from "@/lib/invoice/templates"
import { takePrintJob } from "@/lib/server/store"

export const metadata: Metadata = { title: "Print · PrettyBills", robots: { index: false } }

/** Headless-browser target for PDF export. Renders one invoice, nothing else. */
export default function PrintPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <PrintInvoice params={params} />
    </Suspense>
  )
}

async function PrintInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invoice = await takePrintJob(token)
  if (!invoice) notFound()
  const receipt = templateMeta(invoice.templateId).size === "80mm"
  return (
    <>
      <style>{`@page{margin:0}html,body{background:transparent!important;margin:0}`}</style>
      <div data-print-ready className={signatureFontVars} style={{ width: receipt ? 302 : 794 }}>
        <InvoiceDocument invoice={invoice} fill={!receipt} print />
      </div>
    </>
  )
}
