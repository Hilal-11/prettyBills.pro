import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AlarmClockIcon } from "lucide-react"

import { PageShell } from "@/components/app/page-shell"
import { EmptyState, MissingState } from "@/components/app/states"
import { CreditNoteDocument } from "@/components/credit-notes/credit-note-document"
import { CreditNoteEditor, type EditorDraft } from "@/components/credit-notes/credit-note-editor"
import { CreditNotePanel } from "@/components/credit-notes/credit-note-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { creditableLines, invoiceRates, isCnReason, type CreditLineInput } from "@/lib/billing/credit-notes"
import { creditContext, getCreditNote, type CreditNoteDetail } from "@/lib/server/db/credit-notes"
import { dbMessage } from "@/lib/server/db/util"
import { actionOrigins } from "@/lib/server/http"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Credit note" }

/** A draft opens in the editor; an issued or void note is read-only, with its actions beside it. */
export default function CreditNotePage({ params }: PageProps<"/credit-notes/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-96 rounded-xl" />}>
      <Body params={params} />
    </Suspense>
  )
}

/** Back from a saved draft to what the editor works with. */
function toDraft(note: CreditNoteDetail): EditorDraft {
  const lines: CreditLineInput[] = note.items
    .filter((i) => i.invoiceItemId)
    .map((i) => (i.invoiceItemId!.startsWith("charge:") || i.name.endsWith("(price adjustment)") ? { lineId: i.invoiceItemId!, kind: "amount", amount: i.taxable } : { lineId: i.invoiceItemId!, kind: "qty", qty: i.qty }))
  const lump = note.mode === "lump_sum" && note.items[0] ? { description: note.items[0].name, taxable: note.items[0].taxable, rate: note.items[0].taxRate } : undefined
  return { id: note.id, input: { cnDate: note.date, reason: isCnReason(note.reason) ? note.reason : "other", reasonText: note.reasonText ?? "", notes: note.notes ?? "", mode: note.mode, lines, lump } }
}

async function Body({ params }: { params: PageProps<"/credit-notes/[id]">["params"] }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(`/credit-notes/${id}`)}`)
  const crumbs = [{ label: "Credit notes", href: "/credit-notes" }, { label: "Credit note" }]

  let note: CreditNoteDetail | null
  try {
    note = await getCreditNote(session.db, id)
  } catch (error) {
    return (
      <PageShell crumbs={crumbs}>
        <EmptyState icon={AlarmClockIcon} title="Couldn't load this credit note" body={dbMessage(error)} />
      </PageShell>
    )
  }
  if (!note)
    return (
      <PageShell crumbs={crumbs}>
        <MissingState title="We couldn't find that credit note" body="It may have been a draft that was deleted, or it belongs to a different account." back={{ label: "Back to credit notes", href: "/credit-notes" }} />
      </PageShell>
    )

  if (note.status === "draft") {
    // the draft's own lines don't count against it
    const ctx = await creditContext(session.db, note.invoiceId)
    if (!ctx) redirect("/credit-notes")
    return <CreditNoteEditor invoice={ctx.invoice} summary={ctx.summary} prior={ctx.prior} lines={creditableLines(ctx.invoice, ctx.prior)} rates={invoiceRates(ctx.invoice)} draft={toDraft(note)} />
  }

  const { publicOrigin } = await actionOrigins()
  return (
    <PageShell crumbs={[{ label: "Credit notes", href: "/credit-notes" }, { label: note.number ?? "Credit note" }]} bleed>
      <div className="min-h-0 flex-1 overflow-y-auto lg:flex lg:overflow-hidden">
        <div className="min-w-0 bg-muted/40 p-4 sm:p-6 lg:flex-1 lg:overflow-y-auto dark:bg-black/25">
          <div className="mx-auto max-w-[760px] overflow-hidden rounded-[4px] shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_24px_48px_-24px_rgb(0_0_0/0.35)]">
            <CreditNoteDocument note={note} print />
          </div>
        </div>
        <aside aria-label="Credit note details" className="border-t lg:w-[360px] lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <CreditNotePanel note={note} publicUrl={note.publicToken && note.linkActive ? `${publicOrigin}/cn/${note.publicToken}` : null} />
        </aside>
      </div>
    </PageShell>
  )
}
