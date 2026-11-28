import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CreditNoteDocument } from "@/components/credit-notes/credit-note-document"
import { sharedCreditNote } from "@/lib/server/db/credit-notes"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Credit note", robots: { index: false, follow: false } }

/** A shared credit note: anyone with the link, while it's issued and the link is on. */
export default function SharedCreditNotePage({ params }: PageProps<"/cn/[token]">) {
  return (
    <main className="min-h-svh bg-muted/40 px-4 py-8 dark:bg-black/30">
      <Suspense fallback={<div className="mx-auto aspect-[1/1.414] max-w-[760px] animate-pulse rounded bg-background" />}>
        <Shared params={params} />
      </Suspense>
    </main>
  )
}

async function Shared({ params }: { params: PageProps<"/cn/[token]">["params"] }) {
  const { token } = await params
  const note = await sharedCreditNote(await createClient(), token)
  if (!note) notFound()
  return (
    <div className="mx-auto max-w-[760px] overflow-hidden rounded-[4px] shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_24px_48px_-24px_rgb(0_0_0/0.35)]">
      <CreditNoteDocument note={note} print />
    </div>
  )
}
