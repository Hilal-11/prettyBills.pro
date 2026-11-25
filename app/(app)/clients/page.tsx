import { Suspense } from "react"
import type { Metadata } from "next"
import { AlarmClockIcon, UsersIcon } from "lucide-react"

import { ClientsManager } from "@/components/app/clients-manager"
import { PageShell, PageTitle } from "@/components/app/page-shell"
import { EmptyState, GuestState } from "@/components/app/states"
import { Skeleton } from "@/components/ui/skeleton"
import { dbMessage } from "@/lib/server/db/util"
import { listClientsWithStats } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Clients" }

export default function ClientsPage() {
  return (
    <PageShell crumbs={[{ label: "Clients" }]}>
      <PageTitle title="Clients" description="Everyone you bill, what you've billed them and what they still owe." />
      <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
        <Clients />
      </Suspense>
    </PageShell>
  )
}

async function Clients() {
  const session = await getSession()
  if (!session) return <GuestState icon={UsersIcon} title="Keep your clients in one place" body="Log in to save the people you bill. Their GSTIN and address fill in with one click, and you can see who owes you what." />
  const data = await listClientsWithStats(session.db).catch((error: unknown) => error)
  if (Array.isArray(data)) return <ClientsManager clients={data} />
  return <EmptyState icon={AlarmClockIcon} title="Couldn't load your clients" body={dbMessage(data)} />
}
