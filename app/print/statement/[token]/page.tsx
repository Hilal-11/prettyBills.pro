import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { StatementDocument, type StatementData } from "@/components/clients/statement-document"
import { takeJob } from "@/lib/server/store"

export const metadata: Metadata = { title: "Print · PrettyBills", robots: { index: false } }

/** Headless-browser target for statement PDFs. */
export default function PrintStatementPage({ params }: PageProps<"/print/statement/[token]">) {
  return (
    <Suspense fallback={null}>
      <PrintStatement params={params} />
    </Suspense>
  )
}

async function PrintStatement({ params }: { params: PageProps<"/print/statement/[token]">["params"] }) {
  const { token } = await params
  const data = await takeJob<StatementData>("statement", token)
  if (!data) notFound()
  return (
    <>
      <style>{`@page{margin:0}html,body{background:transparent!important;margin:0}`}</style>
      <div data-print-ready style={{ width: 794 }}>
        <StatementDocument data={data} />
      </div>
    </>
  )
}
