"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { BanIcon, CheckCircle2Icon, FileTextIcon, InfoIcon, LinkIcon, PencilIcon, ScrollTextIcon, XCircleIcon } from "lucide-react"
import { cn } from "cn"

import { DateField, Field, NumberInput, SelectField, TextField } from "@/components/invoice-editor/fields"
import { SectionCard } from "@/components/invoice-editor/section-card"
import type { EditorApi, QuoteState } from "@/components/invoice-editor/use-editor"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/billing/dates"
import { quoteLabel, VALIDITY_PRESETS, validityPreset, validUntilFrom } from "@/lib/billing/quotes"
import { CURRENCIES } from "@/lib/invoice/config"
import { formatDate as formatDocDate } from "@/lib/invoice/format"
import { rise } from "@/lib/motion"
import type { QuoteResult } from "@/lib/server/db/quotes"

import { ConvertDialog } from "./convert-dialog"
import { ReviseDialog } from "./quote-dialogs"

/** Invoice details, for a quote or proforma: number, dates, validity, title, reference. */
export function QuoteDetailsSection({ ed }: { ed: EditorApi }) {
  const inv = ed.invoice
  const q = inv.quote!
  const proforma = q.kind === "proforma"
  const preset = validityPreset(inv.issueDate, q.validUntil)
  const err = (p: string) => ed.errorFor(p)
  const setValid = (iso: string | null) => ed.update((d) => void (d.quote = { ...d.quote!, validUntil: iso }))

  return (
    <SectionCard
      ed={ed}
      id="details"
      icon={FileTextIcon}
      title={proforma ? "Proforma details" : "Quote details"}
      summary={`${inv.number ? quoteLabel(inv.number, inv.revision) : "New"}${q.validUntil ? ` · valid until ${formatDocDate(q.validUntil, inv.dateFormat)}` : ""}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={proforma ? "Proforma number" : "Quote number"} className="col-span-2" htmlFor="f-qnumber" help={inv.number ? (inv.revision > 1 ? `Revision ${inv.revision}: the number stays the same` : "From your series, per financial year") : `Assigned when it's first saved (${proforma ? "PI" : "QT"}/FY/001)`}>
          <TextField field="number" id="f-qnumber" readOnly value={inv.number ? quoteLabel(inv.number, inv.revision) : ""} placeholder="Assigned on save" onChange={() => {}} className="tabular-nums read-only:bg-muted/50" />
        </Field>

        <Field label="Issue date" required error={err("issueDate")}>
          <DateField
            field="issueDate"
            value={inv.issueDate}
            format={inv.dateFormat}
            onChange={(iso) =>
              ed.update((d) => {
                // keep the same validity when the issue date moves
                const days = typeof preset === "number" ? preset : null
                d.issueDate = iso
                if (days !== null && d.quote) d.quote = { ...d.quote, validUntil: validUntilFrom(iso, days) }
              })
            }
          />
        </Field>
        <Field label="Valid until" required={!proforma} error={err("quote.validUntil") ?? ed.validation.errors["quote.validUntil"]} help={proforma ? "Optional for a proforma" : undefined}>
          <DateField field="quote.validUntil" value={q.validUntil ?? ""} min={inv.issueDate} format={inv.dateFormat} onChange={(iso) => setValid(iso || null)} />
        </Field>
        <div className="col-span-2 -mt-1 flex flex-wrap items-center gap-1" role="group" aria-label="Valid for">
          {VALIDITY_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={preset === d}
              onClick={() => setValid(validUntilFrom(inv.issueDate, d))}
              className={cn("h-6 rounded-md border px-2 text-xs transition-colors", preset === d ? "border-brand/50 bg-brand/10 font-medium text-foreground" : "text-foreground/70 hover:bg-muted")}
            >
              {d} days
            </button>
          ))}
          {preset === "custom" && <span className="px-1 text-xs text-muted-foreground">Custom date</span>}
          {proforma && q.validUntil && (
            <button type="button" onClick={() => setValid(null)} className="h-6 rounded-md px-2 text-xs text-foreground/70 hover:bg-muted">
              No date
            </button>
          )}
        </div>

        <Field label="Title">
          {proforma ? (
            <TextField field="quote.title" readOnly value="Proforma Invoice" onChange={() => {}} className="read-only:bg-muted/50" />
          ) : (
            <SelectField field="quote.title" value={q.title} options={[{ value: "Quotation", label: "Quotation" }, { value: "Estimate", label: "Estimate" }]} onChange={(v) => ed.update((d) => void (d.quote = { ...d.quote!, title: v as "Quotation" | "Estimate" }))} />
          )}
        </Field>
        <Field label="Reference">
          <TextField field="reference" value={inv.reference} onChange={(v) => ed.update((d) => void (d.reference = v), "reference")} />
        </Field>

        <Field label="Currency">
          <SelectField
            field="currency"
            value={inv.currency}
            options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
            onChange={(v) =>
              ed.update((d) => {
                d.currency = v
                if (v === "INR") d.exchangeRate = undefined
              })
            }
          />
        </Field>
        {inv.currency !== "INR" ? (
          <Field label={`1 ${inv.currency} = ₹`} required error={ed.validation.errors.exchangeRate}>
            <NumberInput field="exchangeRate" decimals={4} value={inv.exchangeRate ?? 0} onChange={(n) => ed.update((d) => void (d.exchangeRate = n), "exchangeRate")} />
          </Field>
        ) : (
          <Field label="PO / enquiry number" help="Printed only when filled">
            <TextField field="poNumber" value={inv.poNumber} onChange={(v) => ed.update((d) => void (d.poNumber = v), "poNumber")} />
          </Field>
        )}
      </div>
    </SectionCard>
  )
}

/**
 * The strip above the form for a saved quote: sent (Revise to edit),
 * accepted (Convert), declined, converted or void. Also "Created from" for
 * a proforma made from a quote.
 */
export function QuoteBanner({ ed }: { ed: EditorApi }) {
  const router = useRouter()
  const q = ed.quote
  const [revise, setRevise] = React.useState(false)
  const [convert, setConvert] = React.useState<"invoice" | "proforma" | null>(null)
  const source = ed.invoice.source
  if (!q) return source ? <CreatedFrom source={source} /> : null
  const label = quoteLabel(q.number, q.revision)
  const onRevised = (r: QuoteResult) => ed.setQuote({ ...r, display: "draft", viewedAt: null, respondedAt: null, responseAction: null, responseName: null, responseComment: null, responseBy: null })
  const sentOn = q.sentAt ? formatDate(q.sentAt.slice(0, 10)) : null

  let body: React.ReactNode = null
  if (q.status === "sent") {
    body = (
      <Strip tone="info" icon={InfoIcon}>
        <span className="min-w-0 flex-1">
          {q.display === "expired" ? "Expired. " : q.display === "viewed" ? "Viewed by the client. " : ""}Sent to the client{sentOn ? ` on ${sentOn}` : ""}. Editing creates Revision {q.revision + 1}.
        </span>
        <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={() => setRevise(true)}>
          <PencilIcon className="size-3" /> Revise
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => router.push(`/quotes/${q.id}`)}>
          Cancel
        </Button>
      </Strip>
    )
  } else if (q.status === "accepted") {
    const on = q.respondedAt ? formatDate(q.respondedAt.slice(0, 10)) : ""
    body = (
      <Strip tone="good" icon={CheckCircle2Icon}>
        <span className="min-w-0 flex-1">
          {q.responseBy === "owner" ? `Marked accepted by ${q.responseName ?? "you"}` : `Accepted by ${q.responseName ?? "the client"}`}
          {on ? ` on ${on}` : ""}
          {q.responseComment ? <span className="text-foreground/75"> – &ldquo;{q.responseComment}&rdquo;</span> : null}
        </span>
        <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => setConvert("invoice")}>
          Convert to invoice
        </Button>
        {q.kind === "quote" && (
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setConvert("proforma")}>
            Convert to proforma
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setRevise(true)}>
          Revise
        </Button>
      </Strip>
    )
  } else if (q.status === "declined") {
    body = (
      <Strip tone="bad" icon={XCircleIcon}>
        <span className="min-w-0 flex-1">
          Declined{q.responseName ? ` by ${q.responseName}` : ""}
          {q.responseComment ? <span className="text-foreground/75"> – &ldquo;{q.responseComment}&rdquo;</span> : null}. Revise it to send a new offer.
        </span>
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setRevise(true)}>
          Revise
        </Button>
      </Strip>
    )
  } else if (q.status === "converted") {
    body = (
      <Strip tone="info" icon={LinkIcon}>
        <span className="min-w-0 flex-1">Converted. Changes go on the {q.convertedToType === "proforma" ? "proforma" : "invoice"} now.</span>
        {q.convertedToId && (
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" render={<Link href={q.convertedToType === "proforma" ? `/quotes/${q.convertedToId}` : `/invoices/${q.convertedToId}`} />}>
            Open {q.convertedToType === "proforma" ? "proforma" : "invoice"}
          </Button>
        )}
      </Strip>
    )
  } else if (q.status === "void") {
    body = (
      <Strip tone="muted" icon={BanIcon}>
        <span className="min-w-0 flex-1">This {q.kind === "proforma" ? "proforma" : "quote"} is void. It&apos;s kept for your records.</span>
      </Strip>
    )
  }

  return (
    <>
      {source && <CreatedFrom source={source} />}
      {body}
      <ReviseDialog id={q.id} number={label} accepted={q.status === "accepted"} open={revise} onOpenChange={setRevise} onDone={onRevised} />
      {convert && <ConvertDialog quoteId={q.id} open={!!convert} target={convert} onOpenChange={(o) => !o && setConvert(null)} />}
    </>
  )
}

export function CreatedFrom({ source }: { source: NonNullable<EditorApi["invoice"]["source"]> }) {
  return (
    <motion.div initial="hidden" animate="show" variants={rise} className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-foreground/80">
      <ScrollTextIcon className="size-3.5 shrink-0 text-foreground/60" />
      <span className="min-w-0 flex-1 truncate">
        Created from {source.type === "proforma" ? "proforma" : "quote"} <span className="font-medium tabular-nums">{source.number}</span>
      </span>
      <Link href={`/quotes/${source.id}`} className="shrink-0 font-medium text-brand hover:underline dark:text-[#6da2ff]">
        View {source.type === "proforma" ? "proforma" : "quote"}
      </Link>
    </motion.div>
  )
}

function Strip({ tone, icon: Icon, children }: { tone: "info" | "good" | "bad" | "muted"; icon: typeof InfoIcon; children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={rise}
      role="status"
      className={cn(
        "mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        tone === "info" && "border-brand/30 bg-brand/10 text-brand-deep dark:text-[#8fb5ff]",
        tone === "good" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
        tone === "bad" && "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300",
        tone === "muted" && "bg-muted/50 text-foreground/75"
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {children}
    </motion.div>
  )
}

export type { QuoteState }
