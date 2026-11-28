import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CreditNoteDocument, type CreditNoteView } from "@/components/credit-notes/credit-note-document"
import { takeJob } from "@/lib/server/store"

export const metadata: Metadata = { title: "Print · PrettyBills", robots: { index: false } }

/** Headless-browser target for credit note PDFs. Renders one credit note, nothing else. */
export default function PrintCreditNotePage({ params }: PageProps<"/print/credit-note/[token]">) {
  return (
    <Suspense fallback={null}>
      <PrintCreditNote params={params} />
    </Suspense>
  )
}

async function PrintCreditNote({ params }: { params: PageProps<"/print/credit-note/[token]">["params"] }) {
  const { token } = await params
  const note = await takeJob<CreditNoteView>("credit-note", token)
  if (!note) notFound()
  return (
    <>
      <style>{`@page{margin:0}html,body{background:transparent!important;margin:0}`}</style>
      <div data-print-ready style={{ width: 794 }}>
        <CreditNoteDocument note={note} print />
      </div>
    </>
  )
}
