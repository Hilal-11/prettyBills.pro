import { Suspense } from "react"
import type { Metadata } from "next"
import { AlarmClockIcon, BoxIcon } from "lucide-react"

import { ItemsManager } from "@/components/app/items-manager"
import { PageShell, PageTitle } from "@/components/app/page-shell"
import { EmptyState, GuestState } from "@/components/app/states"
import { Skeleton } from "@/components/ui/skeleton"
import { dbMessage } from "@/lib/server/db/util"
import { listItems } from "@/lib/server/db/workspace"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = { title: "Items & services" }

export default function ItemsPage() {
  return (
    <PageShell crumbs={[{ label: "Items & services" }]}>
      <PageTitle title="Items & services" description="What you sell, with HSN/SAC, unit, rate and GST, ready to add to any invoice." />
      <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
        <Items />
      </Suspense>
    </PageShell>
  )
}

async function Items() {
  const session = await getSession()
  if (!session) return <GuestState icon={BoxIcon} title="Save what you sell" body="Log in to keep a catalog of your products and services, with HSN/SAC codes and GST rates, and add them to invoices in one click." />
  const data = await listItems(session.db).catch((error: unknown) => error)
  if (Array.isArray(data)) return <ItemsManager items={data} />
  return <EmptyState icon={AlarmClockIcon} title="Couldn't load your items" body={dbMessage(data)} />
}
