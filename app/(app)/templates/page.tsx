import type { Metadata } from "next"

import { PageShell, PageTitle } from "@/components/app/page-shell"
import { TemplateGallery } from "@/components/app/template-gallery"
import { InvoiceDocument } from "@/components/landing/invoice-document"
import { sampleInvoiceModel } from "@/lib/invoice/sample"
import { TEMPLATES } from "@/lib/invoice/templates"

export const metadata: Metadata = {
  title: "Invoice templates",
  description: "GST invoice templates for every kind of business: pick one and start filling it in.",
  robots: { index: true },
}

/** Every template, drawn with the same sample invoice. Static: no session, no data. */
export default function TemplatesPage() {
  const sample = sampleInvoiceModel()
  const thumbs = Object.fromEntries(TEMPLATES.map((t) => [t.slug, <InvoiceDocument key={t.slug} invoice={sample} template={t.slug} fill={t.size !== "80mm"} decorative />]))
  return (
    <PageShell crumbs={[{ label: "Templates" }]} wide>
      <PageTitle title="Templates" description={`${TEMPLATES.length} designs, every one GST-ready with HSN/SAC, tax breakdown, amount in words and a UPI QR. Switch any time in the editor.`} />
      <TemplateGallery thumbs={thumbs} />
    </PageShell>
  )
}
