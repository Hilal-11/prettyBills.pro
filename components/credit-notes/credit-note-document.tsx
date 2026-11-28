import type { CSSProperties } from "react"
import { cn } from "cn"

import { templateLook } from "@/components/landing/invoice-document"
import { reasonLabel } from "@/lib/billing/credit-notes"
import { formatDate } from "@/lib/billing/dates"
import { amountInWordsINR, formatINR } from "@/lib/billing/money"
import { stateLabel } from "@/lib/invoice/config"
import type { Address, PartySnapshot } from "@/lib/invoice/types"
import type { CreditNoteDetail } from "@/lib/server/db/credit-notes"

/**
 * A GST credit note in the original invoice's look (accent, typeface, page
 * colour): number and date, the invoice it's issued against, the reason,
 * both parties with GSTINs, place of supply, the credited lines with tax,
 * the tax breakup, total in words. "Tax Credit Note" when the business is
 * GST-registered; a VOID watermark once voided; DRAFT while a draft.
 * Sized in `em` off its width, so it's the preview, the public page and the PDF.
 */

const numeric = "tabular-nums [font-feature-settings:'tnum']"

const pages = {
  white: { "--paper": "#ffffff", "--ink": "#111318", "--muted": "#4b5160", "--rule": "#e3e5ea", "--strong-rule": "#111318", "--tint": "#f6f7f9" },
  black: { "--paper": "#0b0b0c", "--ink": "#f5f5f6", "--muted": "rgb(255 255 255 / 0.65)", "--rule": "rgb(255 255 255 / 0.15)", "--strong-rule": "rgb(255 255 255 / 0.7)", "--tint": "rgb(255 255 255 / 0.05)" },
} as const

export type CreditNoteView = Omit<CreditNoteDetail, "allocations" | "refunds">

export function CreditNoteDocument({ note, print = false, className }: { note: CreditNoteView; print?: boolean; className?: string }) {
  const black = note.pageColor === "black"
  const look = templateLook(note.templateId)
  const accent = black && /^#(0|1)[0-9a-f]{5}$/i.test(look.accent) ? "#f5f5f6" : look.accent
  const voided = note.status === "void"
  const draft = note.status === "draft"
  const title = note.from?.gstin ? "Tax Credit Note" : "Credit Note"
  const pos = note.placeOfSupply ? (note.placeOfSupply === "96" ? "Outside India (export)" : stateLabel(note.placeOfSupply)) : null
  const rateRows = [...new Map(note.items.map((i) => [i.taxRate, 0])).keys()]
    .sort((a, b) => a - b)
    .map((rate) => {
      const lines = note.items.filter((i) => i.taxRate === rate)
      return { rate, taxable: lines.reduce((s, i) => s + i.taxable, 0), tax: lines.reduce((s, i) => s + i.tax, 0) }
    })
    .filter((r) => r.tax > 0)

  return (
    <div className={cn("@container w-full", className)} role="img" aria-label={`${title} ${note.number ?? "draft"} for ${formatINR(note.total)} against ${note.invoiceNumber}${voided ? ", void" : ""}`}>
      <article
        className={cn("relative isolate flex flex-col overflow-hidden bg-(--paper) px-[3em] pt-[3em] pb-[2em] text-[length:1.72cqw] leading-[1.5] text-(--ink)", print && "min-h-[141.4cqw]")}
        style={{ ...pages[black ? "black" : "white"], "--accent": accent, fontFamily: look.font } as unknown as CSSProperties}
      >
        {(voided || draft) && (
          <span aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
            <span className={cn("-rotate-[28deg] rounded-[0.15em] border-[0.12em] px-[0.4em] text-[9em] leading-none font-black tracking-[0.08em]", voided ? "border-[#c92a2a]/40 text-[#c92a2a]/20" : "border-(--muted)/30 text-(--muted)/15")}>{voided ? "VOID" : "DRAFT"}</span>
          </span>
        )}

        <header className="relative flex items-start justify-between gap-[2em]">
          <div>
            <h1 className="text-[2.1em] leading-none font-bold tracking-[-0.02em]">{title}</h1>
            <p className="mt-[0.5em] text-[0.92em] font-semibold text-(--accent)">{reasonLabel(note.reason)}</p>
          </div>
          <div className="text-right text-[0.92em]">
            <p className="font-semibold">{note.from?.name || "Your business"}</p>
            {note.from?.gstin && <p className="text-(--muted)">GSTIN {note.from.gstin}</p>}
          </div>
        </header>

        <dl className="relative mt-[1.6em] grid w-fit grid-cols-[auto_auto] gap-x-[1.4em] gap-y-[0.15em] text-[0.92em]">
          <Row k="Credit note no." v={note.number ?? "Draft"} />
          <Row k="Date" v={formatDate(note.date)} />
          <Row k="Original invoice" v={`${note.invoiceNumber} dated ${formatDate(note.invoiceDate)}`} />
          {pos && <Row k="Place of supply" v={pos} />}
        </dl>
        {note.reasonText && <p className="relative mt-[0.6em] text-[0.92em] text-(--muted)">Reason: {note.reasonText}</p>}

        <div className="relative mt-[2em] grid grid-cols-2 gap-[2em] text-[0.92em]">
          <Party title="From" p={note.from as PartySnapshot} />
          <Party title="To" p={note.billTo} />
        </div>

        <table className={cn("relative mt-[2em] w-full border-collapse text-[0.86em]", numeric)}>
          <thead>
            <tr className="border-b-[0.15em] border-(--strong-rule) text-left">
              <th className="py-[0.5em] font-semibold">Item</th>
              <th className="py-[0.5em] font-semibold">HSN/SAC</th>
              <th className="py-[0.5em] text-right font-semibold">Qty</th>
              <th className="py-[0.5em] text-right font-semibold">Rate</th>
              <th className="py-[0.5em] text-right font-semibold">Taxable</th>
              <th className="py-[0.5em] text-right font-semibold">Tax</th>
              <th className="py-[0.5em] text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {note.items.map((i) => (
              <tr key={i.id} className="border-b border-(--rule) align-top">
                <td className="py-[0.5em] pr-[1em]">
                  {i.name}
                  {i.description && <span className="block text-(--muted)">{i.description}</span>}
                </td>
                <td className="py-[0.5em]">{i.hsnSac || "—"}</td>
                <td className="py-[0.5em] text-right">
                  {i.qty}
                  {i.unit ? ` ${i.unit}` : ""}
                </td>
                <td className="py-[0.5em] text-right">{formatINR(i.rate)}</td>
                <td className="py-[0.5em] text-right">{formatINR(i.taxable)}</td>
                <td className="py-[0.5em] text-right">
                  {formatINR(i.tax)}
                  <span className="block text-[0.85em] text-(--muted)">{i.taxRate}%</span>
                </td>
                <td className="py-[0.5em] text-right font-semibold">{formatINR(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={cn("relative mt-[1.4em] ml-auto w-[52%] text-[0.9em]", numeric)}>
          <Total label="Taxable value" value={formatINR(note.taxable)} />
          {note.taxType === "cgst_sgst"
            ? rateRows.flatMap((r) => [
                <Total key={`c${r.rate}`} label={`CGST ${r.rate / 2}%`} value={formatINR(Math.floor(r.tax / 2))} />,
                <Total key={`s${r.rate}`} label={`SGST ${r.rate / 2}%`} value={formatINR(r.tax - Math.floor(r.tax / 2))} />,
              ])
            : rateRows.map((r) => <Total key={r.rate} label={`IGST ${r.rate}%`} value={formatINR(r.tax)} />)}
          {note.roundOff !== 0 && <Total label="Round off" value={formatINR(note.roundOff)} />}
          <Total label="Total credit" value={formatINR(note.total)} strong />
        </div>
        <p className="relative mt-[0.6em] text-right text-[0.86em] text-(--muted)">{amountInWordsINR(note.total)}</p>

        {note.notes && <p className="relative mt-[1.6em] text-[0.9em] whitespace-pre-line">{note.notes}</p>}
        {voided && note.voidReason && <p className="relative mt-[1.2em] text-[0.88em] font-medium text-[#c92a2a]">This credit note was voided: {note.voidReason}</p>}

        <footer className="relative mt-auto border-t border-(--rule) pt-[1em] text-[0.8em] text-(--muted)">
          <p>This credit note is issued against the invoice mentioned above.</p>
          <p className="mt-[0.4em] flex justify-between gap-[1em]">
            <span className={numeric}>
              {note.number ?? "Draft"} · {formatINR(note.total)} · {formatDate(note.date)}
            </span>
            <span>Computer-generated document</span>
          </p>
        </footer>
      </article>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="contents">
      <dt className="font-semibold">{k}</dt>
      <dd className={cn("font-medium", numeric)}>{v}</dd>
    </div>
  )
}

function Party({ title, p }: { title: string; p: PartySnapshot | undefined }) {
  return (
    <div>
      <p className="text-[0.82em] font-semibold tracking-[0.06em] text-(--muted) uppercase">{title}</p>
      <p className="mt-[0.2em] font-semibold">{p?.name || "—"}</p>
      <AddressLines a={p?.address} />
      {p?.gstin && <p>GSTIN {p.gstin}</p>}
    </div>
  )
}

function AddressLines({ a }: { a: Address | undefined }) {
  if (!a) return null
  const city = [a.city, a.pin].filter(Boolean).join(" ")
  return (
    <>
      {a.line1 && <p className="text-(--muted)">{a.line1}</p>}
      {a.line2 && <p className="text-(--muted)">{a.line2}</p>}
      {(city || a.stateCode) && <p className="text-(--muted)">{[city, a.stateCode ? stateLabel(a.stateCode) : ""].filter(Boolean).join(", ")}</p>}
    </>
  )
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-[1em] border-t border-(--rule) py-[0.3em]", strong && "border-(--strong-rule) text-[1.1em] font-bold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
