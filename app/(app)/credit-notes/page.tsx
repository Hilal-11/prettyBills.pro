import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { AlarmClockIcon, FileMinusIcon, PlusIcon, SearchXIcon } from "lucide-react"
import { cn } from "cn"

import { PageTabs, Toolbar } from "@/components/app/data-table"
import { TableEmpty } from "@/components/app/table-empty"
import { ListSearch, LoadMore } from "@/components/app/list-controls"
import { PageShell } from "@/components/app/page-shell"
import { StatStrip, StatTile } from "@/components/app/stat-strip"
import { EmptyState, GuestState } from "@/components/app/states"
import { CreditNotesGrid } from "@/components/credit-notes/credit-notes-grid"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR } from "@/lib/billing/money"
import { creditNoteCounts, listCreditNotes, totalClientCredit, type CreditNoteFilters } from "@/lib/server/db/credit-notes"
import { dbMessage } from "@/lib/server/db/util"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Credit notes" }

const PAGE = 50
const STATUSES = ["all", "draft", "issued", "unapplied", "void"] as const

/** Every credit note, edge to edge like Receipts: status tabs, search, the numbers, the table. */
export default function CreditNotesPage({ searchParams }: PageProps<"/credit-notes">) {
  return (
    <PageShell crumbs={[{ label: "Credit notes" }]} bleed>
      <Suspense fallback={<ListSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </PageShell>
  )
}

const newButton = (
  <Link href="/credit-notes/new" className={cn(buttonVariants(), "h-8 gap-1.5 px-3 text-[13px]")}>
    <PlusIcon /> <span className="hidden sm:inline">New credit note</span>
  </Link>
)

async function Body({ searchParams }: { searchParams: PageProps<"/credit-notes">["searchParams"] }) {
  const session = await getSession()
  if (!session)
    return (
      <div className="overflow-y-auto px-4 py-6 sm:px-6">
        <GuestState icon={FileMinusIcon} title="Credit notes, the GST way" body="Log in to reduce or cancel a sent invoice with a numbered credit note, and refund or carry forward any extra." />
      </div>
    )
  const sp = await searchParams
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? (sp.status as CreditNoteFilters["status"]) : "all"
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : ""
  const clientId = typeof sp.client === "string" && /^[\w-]{1,64}$/.test(sp.client) ? sp.client : undefined
  const page = Math.max(1, Math.min(20, Number(sp.page) || 1))

  let data: [Awaited<ReturnType<typeof listCreditNotes>>, Awaited<ReturnType<typeof creditNoteCounts>>, number]
  try {
    data = await Promise.all([listCreditNotes(session.db, { status, q, clientId }, { limit: PAGE * page }), creditNoteCounts(session.db), totalClientCredit(session.db)])
  } catch (error) {
    return (
      <div className="overflow-y-auto px-4 py-6 sm:px-6">
        <EmptyState icon={AlarmClockIcon} title="Couldn't load credit notes" body={dbMessage(error)} />
      </div>
    )
  }
  const [{ notes, total }, counts, unapplied] = data
  const href = (s: string) => `/credit-notes?${new URLSearchParams({ ...(s !== "all" ? { status: s } : {}), ...(q ? { q } : {}), ...(clientId ? { client: clientId } : {}) })}`
  const issuedTotal = notes.filter((n) => n.status === "issued").reduce((s, n) => s + n.total, 0)

  if (counts.all === 0)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TableEmpty icon={FileMinusIcon} title="No credit notes yet" body="Issue a credit note to reduce or cancel a sent invoice.">
          <Link href="/credit-notes/new" className={cn(buttonVariants(), "mt-2 h-8 gap-1.5 px-3 text-[13px]")}>
            <PlusIcon /> New credit note
          </Link>
        </TableEmpty>
      </div>
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar
        tabs={
          <PageTabs
            label="Credit note status"
            active={status ?? "all"}
            tabs={[
              { id: "all", label: "All", href: href("all"), count: counts.all },
              { id: "draft", label: "Drafts", href: href("draft"), count: counts.draft },
              { id: "issued", label: "Issued", href: href("issued"), count: counts.issued },
              { id: "unapplied", label: "Unapplied credit", href: href("unapplied"), count: counts.unapplied },
              { id: "void", label: "Void", href: href("void"), count: counts.void },
            ]}
          />
        }
      >
        <ListSearch placeholder="Search number, invoice or client" className="sm:w-60" />
        {newButton}
      </Toolbar>
      <StatStrip label="Credit note totals">
        <StatTile label="Credit notes" value={counts.issued.toLocaleString("en-IN")} note={`Issued · ${counts.draft} draft${counts.draft === 1 ? "" : "s"}`} />
        <StatTile label="Credited (shown)" value={formatINR(issuedTotal, { decimals: false })} note="Issued notes in this list" />
        <StatTile label="Client credit" value={formatINR(unapplied, { decimals: false })} tone={unapplied ? undefined : "good"} note={unapplied ? `On ${counts.unapplied} note${counts.unapplied === 1 ? "" : "s"}: apply or refund it` : "Nothing waiting"} href={unapplied ? href("unapplied") : undefined} />
        <StatTile label="Void" value={counts.void.toLocaleString("en-IN")} note="Numbers stay used" href={counts.void ? href("void") : undefined} />
      </StatStrip>
      {notes.length ? (
        <CreditNotesGrid notes={notes} after={notes.length < total ? <LoadMore /> : undefined} />
      ) : (
        <TableEmpty icon={SearchXIcon} title="No credit notes match" body="Try another tab or search.">
          <Link href="/credit-notes" className={cn(buttonVariants({ variant: "outline" }), "mt-2 h-8 px-3 text-[13px]")}>
            Show all
          </Link>
        </TableEmpty>
      )}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Loading credit notes">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="h-7 w-96 rounded-md" />
        <Skeleton className="ml-auto hidden h-8 w-80 rounded-lg md:block" />
      </div>
      <div className="grid grid-cols-2 border-b lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="grid gap-2 border-r px-4 py-3 last:border-r-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-10 items-center gap-6 border-b px-4">
          <Skeleton className="h-3.5 w-4" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="ml-auto h-3.5 w-20" />
        </div>
      ))}
    </div>
  )
}
