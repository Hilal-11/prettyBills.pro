import type { ReactNode } from "react"
import { cn } from "cn"

import { stateLabel } from "@/lib/invoice/config"
import { formatDate } from "@/lib/invoice/format"
import { sampleInvoiceModel } from "@/lib/invoice/sample"
import { computeInvoiceTotals, formatMoney, type Totals as InvoiceTotals } from "@/lib/invoice/totals"
import { documentTitle, footnote, quoteLabel } from "@/lib/billing/quotes"
import type { Invoice } from "@/lib/invoice/types"
import { upiUri } from "@/lib/invoice/upi"
import type { SampleInvoice } from "@/lib/landing/invoice"
import { qrPath } from "@/lib/landing/qr"

import { StandardTemplate } from "./invoice-standard"

/**
 * Renders the sample invoice in one of the template designs.
 *
 * Everything inside is sized in `em`, and the root font size is a fraction of
 * the container width (`cqw`), so the same markup is a crisp thumbnail at
 * 260px and a full-size preview at 720px. Pure render: works on the server
 * (landing, which keeps `qrcode` out of its client bundle) and in the client
 * (the dashboard's live editor).
 */

type Font = "sans" | "serif" | "mono"

type Design = {
  font: Font
  /** Main accent (headings, rules, header band). */
  accent: string
  /** Light tint of the accent for fills. */
  tint: string
  header: "plain" | "band" | "ledger" | "split" | "stripe" | "soft" | "editorial"
  table: "rule" | "zebra" | "boxed" | "minimal"
}

/** Default, recommended template ("Folio"). */
export const DEFAULT_TEMPLATE = "standard"

/** Rupee amounts for the older templates; paise only when not a whole rupee. */
const formatINR = (rupees: number) => formatMoney(Math.round(rupees * 100), { whole: true })

const designs: Record<string, Design | "receipt" | "standard"> = {
  standard: "standard",
  "minimal-mono": { font: "sans", accent: "#111111", tint: "#f4f4f5", header: "plain", table: "rule" },
  "studio-bold": { font: "sans", accent: "#18181b", tint: "#f4f4f5", header: "band", table: "zebra" },
  "classic-ledger": { font: "serif", accent: "#1f4d3a", tint: "#eef4f0", header: "ledger", table: "boxed" },
  "kirana-clean": { font: "sans", accent: "#e4572e", tint: "#fff1ec", header: "split", table: "zebra" },
  "cafe-receipt": "receipt",
  "site-work": { font: "sans", accent: "#1c1c1c", tint: "#fff6d6", header: "stripe", table: "boxed" },
  "clinic-care": { font: "sans", accent: "#0e8f82", tint: "#e9f7f5", header: "soft", table: "minimal" },
  frame: { font: "serif", accent: "#111111", tint: "#f5f3ef", header: "editorial", table: "minimal" },
}

const fontFamily: Record<Font, string> = {
  sans: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  mono: "var(--font-geist-mono), ui-monospace, monospace",
}

/** A template's accent colour and typeface, for documents that follow its look (payment receipts). */
export function templateLook(slug: string): { accent: string; font: string } {
  const d = designs[slug]
  if (!d || typeof d === "string") return { accent: "#111318", font: fontFamily.sans }
  return { accent: d.accent, font: fontFamily[d.font] }
}

type Qr = ReturnType<typeof qrPath>
const numeric = "tabular-nums [font-feature-settings:'tnum']"

export function InvoiceDocument({
  template,
  invoice,
  fill = false,
  decorative = false,
  print = false,
  className,
}: {
  template?: string
  /** PDF output: receipt-style templates drop the grey backdrop and fill the strip. */
  print?: boolean
  /** Defaults to the marketing sample. */
  invoice?: Invoice
  /** Stretch to A4 proportions (thumbnails, full-size preview). */
  fill?: boolean
  /** Hide from assistive tech when a visible label already names it. */
  decorative?: boolean
  className?: string
}) {
  const inv = invoice ?? sampleInvoiceModel()
  const slug = template ?? inv.templateId
  const design = designs[slug] ?? designs[DEFAULT_TEMPLATE]
  const totals = computeInvoiceTotals(inv)
  const qr = qrPath(upiUri(inv, totals))
  const paid = inv.status === "paid"
  const label = `${inv.quote ? documentTitle(inv) : "Invoice"} ${inv.number} from ${inv.from.name} to ${inv.billTo.name}, total ${formatMoney(totals.total, { whole: true })}, ${paid ? "paid" : "due"}`
  const black = inv.pageColor === "black"

  return (
    <div
      className={cn("@container w-full", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      {design === "standard" ? (
        <StandardTemplate invoice={inv} totals={totals} fill={fill && !print} qr={qr} print={print} />
      ) : (
        // Older templates: a black page is the white design inverted, with the
        // QR and logo counter-inverted so they keep their real colours.
        <div className={cn(black && "invert hue-rotate-180 [&_[data-keep-color]]:invert [&_[data-keep-color]]:hue-rotate-180")}>
          {design === "receipt" ? (
            <Receipt {...toLegacy(inv, totals)} fill={fill && !print} qr={qr} bare={print} />
          ) : (
            <A4 {...toLegacy(inv, totals)} design={design} fill={fill} qr={qr} />
          )}
        </div>
      )}
    </div>
  )
}

type LegacyTotals = {
  lines: { id: string; name: string; sac: string; qty: number; rate: number; amount: number }[]
  subtotal: number
  total: number
  taxRows: { label: string; amount: number }[]
}

/** Maps the invoice model onto the shape the older templates render (rupees). */
function toLegacy(inv: Invoice, t: InvoiceTotals): { invoice: SampleInvoice; totals: LegacyTotals } {
  const r = (p: number) => p / 100
  const taxRows = [
    ...t.taxRows.map((row) => ({ label: `${row.kind} ${row.rate}%`, amount: r(row.amount) })),
    ...(t.invoiceDiscount ? [{ label: "Discount", amount: -r(t.invoiceDiscount) }] : []),
    ...t.charges.map((c) => ({ label: c.label || "Charge", amount: r(c.amount) })),
    ...(t.tcs ? [{ label: "TCS", amount: r(t.tcs) }] : []),
    ...(inv.roundOff && t.roundOff ? [{ label: "Round off", amount: r(t.roundOff) }] : []),
  ]
  return {
    invoice: {
      number: inv.number,
      issueDate: formatDate(inv.issueDate, inv.dateFormat),
      dueDate: formatDate(inv.dueDate, inv.dateFormat),
      currency: "INR",
      from: { name: inv.from.name, city: inv.from.address.city, state: stateLabel(inv.from.address.stateCode).replace(/ \(\d+\)$/, ""), stateCode: inv.from.address.stateCode, gstin: inv.from.gstin ?? "" },
      billTo: { name: inv.billTo.name, city: inv.billTo.address.city, state: stateLabel(inv.billTo.address.stateCode).replace(/ \(\d+\)$/, ""), stateCode: inv.billTo.address.stateCode },
      placeOfSupply: stateLabel(inv.placeOfSupply),
      items: [],
      tax: { type: t.mode === "intra" ? "CGST+SGST" : "IGST", rate: inv.items[0]?.taxRate ?? 0 },
      upi: { id: inv.payment.upiId ?? "", payeeName: inv.from.name },
      status: inv.status === "paid" ? "PAID" : "DUE",
      display: { showQr: inv.payment.showUpiQr && !!inv.payment.upiId, payNow: inv.payment.paymentLink && !inv.quote },
      ...(inv.quote
        ? {
            number: quoteLabel(inv.number, inv.revision),
            doc: {
              title: documentTitle(inv),
              dueLabel: "Valid until",
              due: inv.quote.validUntil ? formatDate(inv.quote.validUntil, inv.dateFormat) : "—",
              footnote: footnote(inv.quote.kind),
            },
          }
        : {}),
      notes: inv.notes,
    },
    totals: {
      lines: inv.items.map((it, i) => ({ id: it.id, name: it.name, sac: it.hsnSac ?? "", qty: it.qty, rate: r(it.rate), amount: r(t.lines[i]?.base ?? 0) })),
      subtotal: r(t.subtotal),
      total: r(t.total),
      taxRows,
    },
  }
}

type Totals = LegacyTotals

/* ------------------------------------------------------------------ */
/* A4 layouts                                                          */
/* ------------------------------------------------------------------ */

function A4({ invoice, totals, design, fill, qr }: { invoice: SampleInvoice; totals: Totals; design: Design; fill: boolean; qr: Qr }) {
  const { accent, tint, header, table } = design
  const bleedHeader = header === "band" || header === "stripe"

  return (
    <article
      className={cn(
        "relative flex flex-col bg-white text-[length:2.25cqw] leading-[1.45] text-[#16181d] select-none",
        fill && "min-h-[141.4cqw]",
        bleedHeader ? "pb-[2.6em]" : "p-[2.6em]",
        header === "split" && "border-l-[0.6em]"
      )}
      style={{ fontFamily: fontFamily[design.font], borderLeftColor: header === "split" ? accent : undefined }}
    >
      <div data-region="details">
        <Header invoice={invoice} design={design} />
      </div>

      <div className={cn("flex flex-1 flex-col", bleedHeader && "px-[2.6em]")}>
        {/* Parties */}
        <div className="mt-[2em] grid grid-cols-2 gap-[2em]">
          <Party label="From" accent={accent} region="business">
            <p className="font-semibold">{invoice.from.name}</p>
            <p className="text-[#5b6170]">
              {invoice.from.city}, {invoice.from.state}
            </p>
            <p className={cn("text-[#5b6170]", numeric)}>GSTIN {invoice.from.gstin}</p>
          </Party>
          <Party label="Bill to" accent={accent} region="client">
            <p className="font-semibold">{invoice.billTo.name}</p>
            <p className="text-[#5b6170]">
              {invoice.billTo.city}, {invoice.billTo.state}
            </p>
            <p className="text-[#5b6170]">Place of supply: {invoice.placeOfSupply}</p>
          </Party>
        </div>

        {/* Items */}
        <div data-region="items" className={cn("mt-[2em]", table === "boxed" && "border border-[#d9dce3]")}>
          <div
            className={cn(
              "grid grid-cols-[1fr_5em_2.6em_5.6em_6em] gap-x-[0.8em] px-[0.7em] py-[0.55em] text-[0.78em] font-semibold tracking-[0.06em] uppercase",
              table === "rule" && "border-y border-[#16181d] px-0",
              table === "minimal" && "border-b border-[#d9dce3] px-0 text-[#5b6170]",
              (table === "zebra" || table === "boxed") && "text-white"
            )}
            style={table === "zebra" || table === "boxed" ? { backgroundColor: accent } : undefined}
          >
            <span>Item</span>
            <span>SAC</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
          </div>
          {totals.lines.map((line, i) => (
            <div
              key={line.id ?? `${i}-${line.name}`}
              className={cn(
                "grid grid-cols-[1fr_5em_2.6em_5.6em_6em] gap-x-[0.8em] px-[0.7em] py-[0.7em]",
                (table === "rule" || table === "minimal") && "border-b border-[#e6e8ed] px-0",
                table === "boxed" && i > 0 && "border-t border-[#d9dce3]",
                numeric
              )}
              style={table === "zebra" && i % 2 === 1 ? { backgroundColor: tint } : undefined}
            >
              <span className="font-medium">{line.name}</span>
              <span className="text-[#5b6170]">{line.sac}</span>
              <span className="text-right">{line.qty}</span>
              <span className="text-right">{formatINR(line.rate)}</span>
              <span className="text-right">{formatINR(line.amount)}</span>
            </div>
          ))}
        </div>

        {/* Payment + totals */}
        <div className="mt-[1.8em] grid grid-cols-[1fr_15em] items-start gap-[2em]">
          {invoice.display?.showQr !== false ? <PayBlock invoice={invoice} accent={accent} tint={tint} qr={qr} /> : <Notes invoice={invoice} />}
          <div data-region="tax" className={cn("relative", numeric)}>
            <Row label="Subtotal" value={formatINR(totals.subtotal)} />
            {totals.taxRows.map((t) => (
              <Row key={t.label} label={t.label} value={formatINR(t.amount)} />
            ))}
            <div
              className="mt-[0.5em] flex items-baseline justify-between border-t-2 pt-[0.6em]"
              style={{ borderColor: accent }}
            >
              <span className="font-semibold">Total</span>
              <span className="text-[1.45em] font-bold tracking-[-0.01em]" style={{ color: header === "plain" || header === "editorial" ? undefined : accent }}>
                {formatINR(totals.total)}
              </span>
            </div>
            {invoice.status === "PAID" && <PaidStamp />}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-end justify-between gap-[1em] pt-[5.2em] text-[0.78em] text-[#7a8090]">
          <span>{invoice.doc?.footnote ?? "Thank you for your business."}</span>
          <span>Made with PrettyBills</span>
        </div>
      </div>
    </article>
  )
}

function Header({ invoice, design }: { invoice: SampleInvoice; design: Design }) {
  const { accent, tint, header } = design
  const title = invoice.doc?.title ?? "Invoice"
  const meta = (
    <dl className="grid grid-cols-[auto_auto] gap-x-[1em] gap-y-[0.15em] text-[0.85em] tabular-nums">
      <dt className="opacity-70">{invoice.doc ? "No." : "Invoice no."}</dt>
      <dd className="text-right font-semibold">{invoice.number}</dd>
      <dt className="opacity-70">Date</dt>
      <dd className="text-right">{invoice.issueDate}</dd>
      <dt className="opacity-70">{invoice.doc?.dueLabel ?? "Due"}</dt>
      <dd className="text-right">{invoice.doc?.due ?? invoice.dueDate}</dd>
    </dl>
  )

  switch (header) {
    case "band":
      return (
        <header className="flex items-end justify-between px-[2.6em] pt-[2.4em] pb-[1.8em] text-white" style={{ backgroundColor: accent }}>
          <div>
            <Monogram name={invoice.from.name} bg="#ffffff" fg={accent} />
            <p className="mt-[0.9em] text-[2.6em] leading-none font-extrabold tracking-[-0.03em]">{title}</p>
          </div>
          {meta}
        </header>
      )
    case "stripe":
      return (
        <header>
          <div className="h-[1.1em] bg-[repeating-linear-gradient(-45deg,#f2b705_0_1em,#1c1c1c_1em_2em)]" />
          <div className="flex items-end justify-between px-[2.6em] pt-[1.8em]">
            <div>
              <p className="text-[0.8em] font-semibold tracking-[0.14em] text-[#5b6170] uppercase">Site work · {invoice.doc ? "Not a tax invoice" : "Tax invoice"}</p>
              <p className="mt-[0.2em] text-[2.3em] leading-none font-black tracking-[-0.02em] uppercase">{title}</p>
            </div>
            <div className="rounded-[0.3em] px-[0.9em] py-[0.6em]" style={{ backgroundColor: tint }}>
              {meta}
            </div>
          </div>
        </header>
      )
    case "ledger":
      return (
        <header className="text-center">
          <p className="text-[0.8em] tracking-[0.3em] uppercase" style={{ color: accent }}>
            {invoice.doc?.title ?? "Tax Invoice"}
          </p>
          <p className="mt-[0.3em] text-[2.1em] leading-tight font-semibold">{invoice.from.name}</p>
          <div className="mt-[0.9em] border-y-[0.2em] border-double py-[0.5em]" style={{ borderColor: accent }}>
            <div className="flex justify-center gap-[2.2em] text-[0.85em] tabular-nums">
              <span>No. {invoice.number}</span>
              <span>{invoice.issueDate}</span>
              <span>{invoice.doc ? `${invoice.doc.dueLabel} ${invoice.doc.due}` : `Due ${invoice.dueDate}`}</span>
            </div>
          </div>
        </header>
      )
    case "split":
      return (
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-[0.8em]">
            <Monogram name={invoice.from.name} bg={accent} fg="#ffffff" round />
            <div>
              <p className="text-[1.2em] font-bold">{invoice.from.name}</p>
              <p className="text-[0.85em] text-[#5b6170]">{invoice.doc ? "Not a tax invoice" : "GST bill"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[1.7em] leading-none font-bold" style={{ color: accent }}>
              {title}
            </p>
            <div className="mt-[0.6em]">{meta}</div>
          </div>
        </header>
      )
    case "soft":
      return (
        <header className="-mx-[2.6em] -mt-[2.6em] flex items-center justify-between px-[2.6em] py-[2em]" style={{ backgroundColor: tint }}>
          <div className="flex items-center gap-[0.8em]">
            <span className="grid size-[2.4em] place-items-center rounded-full text-[1.1em] font-bold text-white" style={{ backgroundColor: accent }}>
              +
            </span>
            <div>
              <p className="text-[1.5em] leading-tight font-semibold" style={{ color: accent }}>
                {title}
              </p>
              <p className="text-[0.85em] text-[#5b6170]">{invoice.from.name}</p>
            </div>
          </div>
          {meta}
        </header>
      )
    case "editorial":
      return (
        <header className="flex items-end justify-between border-b border-[#16181d] pb-[1.2em]">
          <p className="text-[3.2em] leading-[0.9] font-normal tracking-[0.12em] uppercase">{title}</p>
          {meta}
        </header>
      )
    default:
      return (
        <header className="flex items-start justify-between">
          <div>
            <Monogram name={invoice.from.name} bg={accent} fg="#ffffff" />
            <p className="mt-[1.2em] text-[2em] leading-none font-semibold tracking-[-0.03em]">{title}</p>
          </div>
          {meta}
        </header>
      )
  }
}

function Party({ label, accent, region, children }: { label: string; accent: string; region?: string; children: ReactNode }) {
  return (
    <div data-region={region} className="text-[0.92em]">
      <p className="mb-[0.35em] text-[0.78em] font-semibold tracking-[0.08em] uppercase" style={{ color: accent }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-[0.2em] text-[#40454f]">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Notes({ invoice }: { invoice: SampleInvoice }) {
  if (!invoice.notes) return <div />
  return (
    <div className="text-[0.85em] text-[#5b6170]">
      <p className="mb-[0.3em] text-[0.9em] font-semibold tracking-[0.08em] text-[#16181d] uppercase">Notes</p>
      <p className="whitespace-pre-line">{invoice.notes}</p>
    </div>
  )
}

function PayBlock({ invoice, accent, tint, qr }: { invoice: SampleInvoice; accent: string; tint: string; qr: Qr }) {
  return (
    <div data-region="payment" className="flex items-center gap-[1em] rounded-[0.4em] p-[0.9em]" style={{ backgroundColor: tint }}>
      <QrCode qr={qr} className="size-[6.2em] shrink-0 rounded-[0.2em] bg-white p-[0.3em]" />
      <div className="min-w-0 text-[0.85em]">
        <p className="font-semibold">Scan to pay with UPI</p>
        <p className="truncate text-[#5b6170]">{invoice.upi.id}</p>
        {invoice.display?.payNow !== false && (
          <span
            className="mt-[0.7em] inline-block rounded-[0.35em] px-[1em] py-[0.4em] font-semibold text-white"
            style={{ backgroundColor: accent, boxShadow: "0 0.18em 0 rgba(0,0,0,0.28)" }}
          >
            Pay now
          </span>
        )}
      </div>
    </div>
  )
}

function PaidStamp({ className }: { className?: string }) {
  return (
    <span className={cn("pointer-events-none absolute top-full right-[0.4em] mt-[0.9em] rotate-[-10deg] rounded-[0.3em] border-[0.18em] border-[#12805c] px-[0.6em] py-[0.1em] text-[1.5em] font-black tracking-[0.12em] text-[#12805c] opacity-85", className)}>
      PAID
    </span>
  )
}

function Monogram({ name, bg, fg, round }: { name: string; bg: string; fg: string; round?: boolean }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
  return (
    <span
      className={cn("grid size-[2.6em] place-items-center text-[1em] font-bold tracking-[-0.02em]", round ? "rounded-full" : "rounded-[0.35em]")}
      style={{ backgroundColor: bg, color: fg }}
    >
      {initials}
    </span>
  )
}

function QrCode({ qr, className }: { qr: Qr; className?: string }) {
  return (
    <svg data-keep-color viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" className={cn("bg-white", className)}>
      <path d={qr.d} fill="#111" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* 80mm thermal receipt                                               */
/* ------------------------------------------------------------------ */

function Receipt({ invoice, totals, fill, qr, bare = false }: { invoice: SampleInvoice; totals: Totals; fill: boolean; qr: Qr; bare?: boolean }) {
  const dashed = "border-t border-dashed border-[#9aa0ab]"
  return (
    <div className={cn("flex justify-center", !bare && "bg-[#eceef2] py-[6cqw]", fill && "min-h-[141.4cqw]")}>
      <article
        className={cn(
          "bg-white px-[1.6em] py-[1.8em] leading-[1.5] text-[#16181d] select-none",
          bare ? "w-full text-[length:4.05cqw]" : "w-[58cqw] text-[length:2.35cqw] shadow-[0_0.3em_0_rgba(0,0,0,0.06)]"
        )}
        style={{ fontFamily: fontFamily.mono }}
      >
        <div className="text-center">
          <p className="text-[1.15em] font-bold uppercase">{invoice.from.name}</p>
          <p className="text-[0.85em] text-[#5b6170]">
            {invoice.from.city} · GSTIN {invoice.from.gstin}
          </p>
          <p className="mt-[0.6em] font-semibold tracking-[0.2em] uppercase">{invoice.doc?.title ?? "Tax invoice"}</p>
        </div>
        <div className={cn("mt-[0.8em] pt-[0.6em] text-[0.85em]", dashed)}>
          <p>No: {invoice.number}</p>
          <p>Date: {invoice.issueDate}</p>
          <p>To: {invoice.billTo.name}</p>
        </div>
        <div className={cn("mt-[0.6em] pt-[0.6em] tabular-nums", dashed)}>
          {totals.lines.map((line, i) => (
            <div key={line.id ?? `${i}-${line.name}`} className="mb-[0.4em]">
              <p>{line.name}</p>
              <div className="flex justify-between text-[#5b6170]">
                <span>
                  {line.qty} x {formatINR(line.rate)}
                </span>
                <span className="text-[#16181d]">{formatINR(line.amount)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={cn("relative pt-[0.6em] tabular-nums", dashed)}>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatINR(totals.subtotal)}</span>
          </div>
          {totals.taxRows.map((t) => (
            <div key={t.label} className="flex justify-between">
              <span>{t.label}</span>
              <span>{formatINR(t.amount)}</span>
            </div>
          ))}
          <div className="mt-[0.3em] flex justify-between text-[1.2em] font-bold">
            <span>TOTAL</span>
            <span>{formatINR(totals.total)}</span>
          </div>
          {invoice.status === "PAID" && <PaidStamp className="top-[-0.6em] right-auto left-[42%] mt-0" />}
        </div>
        <div className={cn("mt-[0.7em] flex flex-col items-center pt-[0.9em] text-center text-[0.85em]", dashed)}>
          {invoice.display?.showQr !== false && (
            <>
              <QrCode qr={qr} className="size-[8em]" />
              <p className="mt-[0.4em]">Scan to pay · {invoice.upi.id}</p>
            </>
          )}
          {invoice.doc && <p className="mt-[0.6em]">Valid until {invoice.doc.due}</p>}
          <p className="mt-[0.6em] text-[#7a8090]">{invoice.doc?.footnote ?? "Thank you, visit again"}</p>
        </div>
      </article>
    </div>
  )
}
