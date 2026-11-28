import type { Metadata } from "next"

import { PageShell } from "@/components/app/page-shell"
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
    <PageShell
      crumbs={[{ label: "Templates" }]}
      actions={<span className="hidden text-xs text-muted-foreground md:inline">{TEMPLATES.length} designs · all GST-ready with HSN/SAC, tax breakdown and UPI QR</span>}
      bleed
    >
      <TemplateGallery thumbs={thumbs} />
    </PageShell>
  )
}
