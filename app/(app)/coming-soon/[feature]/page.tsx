import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SparklesIcon } from "lucide-react"

import { PageShell } from "@/components/app/page-shell"
import { EmptyState } from "@/components/app/states"
import { featureById } from "@/config/features"
import { navItemById } from "@/lib/dashboard/data"

export const metadata: Metadata = { title: "Coming soon", robots: { index: false } }

/**
 * The one "Coming soon" page. proxy.ts rewrites any route whose feature
 * isn't live yet (config/features.ts) to /coming-soon/<feature id>, so the
 * address bar keeps the URL that was opened. Live or unknown ids 404.
 */
export default function ComingSoonPage({ params }: PageProps<"/coming-soon/[feature]">) {
  return (
    <Suspense>
      <ComingSoon params={params} />
    </Suspense>
  )
}

async function ComingSoon({ params }: { params: PageProps<"/coming-soon/[feature]">["params"] }) {
  const { feature: id } = await params
  const feature = featureById(id)
  if (!feature || feature.status === "live") notFound()
  const icon = navItemById(id)?.icon ?? SparklesIcon
  return (
    <PageShell crumbs={[{ label: feature.name }]}>
      <EmptyState icon={icon} title={`${feature.name} is coming soon`} body={feature.description} action={{ label: "Back to invoices", href: "/invoices" }} />
    </PageShell>
  )
}
