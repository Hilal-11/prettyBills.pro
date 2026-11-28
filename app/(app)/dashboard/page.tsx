import { Suspense } from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import Link from "next/link"
import { AlarmClockIcon, CheckCircle2Icon, HourglassIcon, LayoutDashboardIcon } from "lucide-react"
import { cn } from "cn"

import { OpenSettings, RefreshButton } from "@/components/app/client-buttons"
import { PageShell } from "@/components/app/page-shell"
import { EmptyState, GuestState } from "@/components/app/states"
import { Board } from "@/components/dashboard/board/board"
import { KpiStrip } from "@/components/invoices/kpi-strip"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { COOKIE, parseBoards } from "@/lib/dashboard/boards"
import { dashboardData } from "@/lib/server/db/dashboard"
import { cachedDashboard, serverCacheAvailable } from "@/lib/server/db/dashboard-cache"
import { dbMessage, today } from "@/lib/server/db/util"
import { getSettings, listClients } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Dashboard" }

/**
 * The dashboard, edge to edge: the four headline numbers, then the cards of
 * whichever dashboard is open. People build their own from the card catalog
 * and templates (components/dashboard/board); the layout lives in a cookie.
 */
export default function DashboardPage() {
  return (
    <PageShell crumbs={[{ label: "Dashboard" }]} actions={<RefreshButton />} bleed>
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewBody />
      </Suspense>
    </PageShell>
  )
}

async function OverviewBody() {
  const session = await getSession()
  if (!session) {
    return (
      <Padded>
        <GuestState
          icon={LayoutDashboardIcon}
          title="Your business at a glance"
          body="Log in to see what you're owed, what's overdue and what your clients have opened, all in one place. Making invoices works without an account."
        />
      </Padded>
    )
  }

  let data: Awaited<ReturnType<typeof dashboardData>>
  try {
    // authenticated above; the cached read is keyed and filtered by this user (lib/server/db/dashboard-cache)
    data = serverCacheAvailable() ? await cachedDashboard(session.userId, today()) : await dashboardData(session.db)
  } catch (error) {
    return (
      <Padded>
        <EmptyState icon={AlarmClockIcon} title="Couldn't load your dashboard" body={dbMessage(error)} />
      </Padded>
    )
  }

  if (data.overview.all === 0) {
    const [settings, clients] = await Promise.all([getSettings(session.db).catch(() => null), listClients(session.db).catch(() => [])])
    return (
      <Padded>
        <GettingStarted hasBusiness={!!settings?.business?.name} hasClient={clients.length > 0} />
      </Padded>
    )
  }

  const boards = parseBoards((await cookies()).get(COOKIE)?.value)
  return <Board initial={boards} data={data} top={<KpiStrip overview={data.overview} insights={data.insights} today={data.today} clientCredit={data.clientCredit} />} />
}

function Padded({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</div>
}

/** First run: three steps from nothing to a sent invoice. */
function GettingStarted({ hasBusiness, hasClient }: { hasBusiness: boolean; hasClient: boolean }) {
  const steps = [
    { done: hasBusiness, title: "Add your business details", body: "Name, GSTIN and address, filled in on every invoice.", action: <OpenSettings tab="business" className={stepBtn}>Add details</OpenSettings> },
    { done: hasClient, title: "Add a client", body: "Save the people you bill, so their details are one click away.", action: <Link href="/clients" className={stepBtn}>Add a client</Link> },
    { done: false, title: "Create your first invoice", body: "Pick a template, add items, and send it or share a link.", action: <Link href="/create" className={cn(buttonVariants(), "h-7 px-2.5 text-xs")}>Create invoice</Link> },
  ]
  return (
    <div className="grid gap-6">
      <EmptyState icon={LayoutDashboardIcon} title="No invoices yet" body="Create an invoice to track collections, outstanding amounts and your top clients." action={{ label: "Create your first invoice", href: "/create" }} />
      <section className="overflow-hidden rounded-xl border bg-background">
        <div className="border-b px-4 py-3">
          <h2 className="text-[14px] font-semibold">Get set up</h2>
          <p className="text-xs text-muted-foreground">Three steps, a couple of minutes. Each one saves time on every invoice after.</p>
        </div>
        <ol className="divide-y">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold", s.done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")}>
                {s.done ? <CheckCircle2Icon className="size-3.5" /> : i + 1}
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className={cn("text-[13px] font-medium", s.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{s.title}</span>
                <span className="text-xs text-muted-foreground">{s.body}</span>
              </span>
              {!s.done && s.action}
            </li>
          ))}
        </ol>
      </section>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <HourglassIcon className="size-3.5" /> Prefer to start straight away? <Link href="/create" className="font-medium text-brand hover:underline dark:text-[#6da2ff]">Make an invoice</Link> and save details as you go.
      </p>
    </div>
  )
}

const stepBtn = "inline-flex h-7 shrink-0 items-center rounded-md border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted"

function OverviewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="h-7 w-28 rounded-md" />
        <Skeleton className="ml-auto h-8 w-52 rounded-lg" />
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
      <div className="grid lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn("grid h-64 content-start gap-3 border-r border-b p-4", i === 0 && "lg:col-span-2")}>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-full min-h-40 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
