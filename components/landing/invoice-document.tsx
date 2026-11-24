import type { ReactNode } from "react"
import { cn } from "cn"

import { formatINR, invoiceTotals, sampleInvoice, upiLink, type SampleInvoice } from "@/lib/landing/invoice"
import { qrPath } from "@/lib/landing/qr"

/**
 * Renders the sample invoice in one of the template designs.
 *
 * Everything inside is sized in `em`, and the root font size is a fraction of
 * the container width (`cqw`), so the same markup is a crisp thumbnail at
 * 260px and a full-size preview at 720px. Server-only: keeps `qrcode` out of
 * the client bundle. Client components receive the rendered element as a prop.
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

const designs: Record<string, Design | "receipt"> = {
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

const qr = qrPath(upiLink(sampleInvoice))
const numeric = "tabular-nums [font-feature-settings:'tnum']"

export function InvoiceDocument({
  template,
  invoice = sampleInvoice,
  fill = false,
  decorative = false,
  className,
}: {
  template: string
  invoice?: SampleInvoice
  /** Stretch to A4 proportions (thumbnails, full-size preview). */
  fill?: boolean
  /** Hide from assistive tech when a visible label already names it. */
  decorative?: boolean
  className?: string
}) {
  const design = designs[template] ?? designs["minimal-mono"]
  const totals = invoiceTotals(invoice)
  const label = `Sample invoice ${invoice.number} from ${invoice.from.name} to ${invoice.billTo.name}, total ${formatINR(totals.total)}, marked paid`

  return (
    <div
      className={cn("@container w-full", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      {design === "receipt" ? (
        <Receipt invoice={invoice} totals={totals} fill={fill} />
      ) : (
        <A4 invoice={invoice} totals={totals} design={design} fill={fill} />
      )}
    </div>
  )
}

type Totals = ReturnType<typeof invoiceTotals>

/* ------------------------------------------------------------------ */
/* A4 layouts                                                          */
/* ------------------------------------------------------------------ */

function A4({ invoice, totals, design, fill }: { invoice: SampleInvoice; totals: Totals; design: Design; fill: boolean }) {
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
      <Header invoice={invoice} design={design} />

      <div className={cn("flex flex-1 flex-col", bleedHeader && "px-[2.6em]")}>
        {/* Parties */}
        <div className="mt-[2em] grid grid-cols-2 gap-[2em]">
          <Party label="From" accent={accent}>
            <p className="font-semibold">{invoice.from.name}</p>
            <p className="text-[#5b6170]">
              {invoice.from.city}, {invoice.from.state}
            </p>
            <p className={cn("text-[#5b6170]", numeric)}>GSTIN {invoice.from.gstin}</p>
          </Party>
          <Party label="Bill to" accent={accent}>
            <p className="font-semibold">{invoice.billTo.name}</p>
            <p className="text-[#5b6170]">
              {invoice.billTo.city}, {invoice.billTo.state}
            </p>
            <p className="text-[#5b6170]">Place of supply: {invoice.placeOfSupply}</p>
          </Party>
        </div>

        {/* Items */}
        <div className={cn("mt-[2em]", table === "boxed" && "border border-[#d9dce3]")}>
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
              key={line.name}
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
          <PayBlock invoice={invoice} accent={accent} tint={tint} />
          <div className={cn("relative", numeric)}>
            <Row label="Subtotal" value={formatINR(totals.subtotal)} />
            <Row label={`${invoice.tax.type} ${invoice.tax.rate}%`} value={formatINR(totals.tax)} />
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
          <span>Thank you for your business.</span>
          <span>Made with Prettybill</span>
        </div>
      </div>
    </article>
  )
}

function Header({ invoice, design }: { invoice: SampleInvoice; design: Design }) {
  const { accent, tint, header } = design
  const meta = (
    <dl className="grid grid-cols-[auto_auto] gap-x-[1em] gap-y-[0.15em] text-[0.85em] tabular-nums">
      <dt className="opacity-70">Invoice no.</dt>
      <dd className="text-right font-semibold">{invoice.number}</dd>
      <dt className="opacity-70">Date</dt>
      <dd className="text-right">{invoice.issueDate}</dd>
      <dt className="opacity-70">Due</dt>
      <dd className="text-right">{invoice.dueDate}</dd>
    </dl>
  )

  switch (header) {
    case "band":
      return (
        <header className="flex items-end justify-between px-[2.6em] pt-[2.4em] pb-[1.8em] text-white" style={{ backgroundColor: accent }}>
          <div>
            <Monogram name={invoice.from.name} bg="#ffffff" fg={accent} />
            <p className="mt-[0.9em] text-[2.6em] leading-none font-extrabold tracking-[-0.03em]">Invoice</p>
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
              <p className="text-[0.8em] font-semibold tracking-[0.14em] text-[#5b6170] uppercase">Site work · Tax invoice</p>
              <p className="mt-[0.2em] text-[2.3em] leading-none font-black tracking-[-0.02em] uppercase">Invoice</p>
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
            Tax Invoice
          </p>
          <p className="mt-[0.3em] text-[2.1em] leading-tight font-semibold">{invoice.from.name}</p>
          <div className="mt-[0.9em] border-y-[0.2em] border-double py-[0.5em]" style={{ borderColor: accent }}>
            <div className="flex justify-center gap-[2.2em] text-[0.85em] tabular-nums">
              <span>No. {invoice.number}</span>
              <span>{invoice.issueDate}</span>
              <span>Due {invoice.dueDate}</span>
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
              <p className="text-[0.85em] text-[#5b6170]">GST bill</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[1.7em] leading-none font-bold" style={{ color: accent }}>
              Invoice
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
                Invoice
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
          <p className="text-[3.2em] leading-[0.9] font-normal tracking-[0.12em] uppercase">Invoice</p>
          {meta}
        </header>
      )
    default:
      return (
        <header className="flex items-start justify-between">
          <div>
            <Monogram name={invoice.from.name} bg={accent} fg="#ffffff" />
            <p className="mt-[1.2em] text-[2em] leading-none font-semibold tracking-[-0.03em]">Invoice</p>
          </div>
          {meta}
        </header>
      )
  }
}

function Party({ label, accent, children }: { label: string; accent: string; children: ReactNode }) {
  return (
    <div className="text-[0.92em]">
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

function PayBlock({ invoice, accent, tint }: { invoice: SampleInvoice; accent: string; tint: string }) {
  return (
    <div className="flex items-center gap-[1em] rounded-[0.4em] p-[0.9em]" style={{ backgroundColor: tint }}>
      <QrCode className="size-[6.2em] shrink-0 rounded-[0.2em] bg-white p-[0.3em]" />
      <div className="min-w-0 text-[0.85em]">
        <p className="font-semibold">Scan to pay with UPI</p>
        <p className="truncate text-[#5b6170]">{invoice.upi.id}</p>
        <span
          className="mt-[0.7em] inline-block rounded-[0.35em] px-[1em] py-[0.4em] font-semibold text-white"
          style={{ backgroundColor: accent, boxShadow: "0 0.18em 0 rgba(0,0,0,0.28)" }}
        >
          Pay now
        </span>
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

function QrCode({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" className={className}>
      <path d={qr.d} fill="#111" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* 80mm thermal receipt                                               */
/* ------------------------------------------------------------------ */

function Receipt({ invoice, totals, fill }: { invoice: SampleInvoice; totals: Totals; fill: boolean }) {
  const dashed = "border-t border-dashed border-[#9aa0ab]"
  return (
    <div className={cn("flex justify-center bg-[#eceef2] py-[6cqw]", fill && "min-h-[141.4cqw]")}>
      <article
        className="w-[58cqw] bg-white px-[1.6em] py-[1.8em] text-[length:2.35cqw] leading-[1.5] text-[#16181d] shadow-[0_0.3em_0_rgba(0,0,0,0.06)] select-none"
        style={{ fontFamily: fontFamily.mono }}
      >
        <div className="text-center">
          <p className="text-[1.15em] font-bold uppercase">{invoice.from.name}</p>
          <p className="text-[0.85em] text-[#5b6170]">
            {invoice.from.city} · GSTIN {invoice.from.gstin}
          </p>
          <p className="mt-[0.6em] font-semibold tracking-[0.2em]">TAX INVOICE</p>
        </div>
        <div className={cn("mt-[0.8em] pt-[0.6em] text-[0.85em]", dashed)}>
          <p>No: {invoice.number}</p>
          <p>Date: {invoice.issueDate}</p>
          <p>To: {invoice.billTo.name}</p>
        </div>
        <div className={cn("mt-[0.6em] pt-[0.6em] tabular-nums", dashed)}>
          {totals.lines.map((line) => (
            <div key={line.name} className="mb-[0.4em]">
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
          <div className="flex justify-between">
            <span>
              {invoice.tax.type} {invoice.tax.rate}%
            </span>
            <span>{formatINR(totals.tax)}</span>
          </div>
          <div className="mt-[0.3em] flex justify-between text-[1.2em] font-bold">
            <span>TOTAL</span>
            <span>{formatINR(totals.total)}</span>
          </div>
          {invoice.status === "PAID" && <PaidStamp className="top-[-0.6em] right-auto left-[42%] mt-0" />}
        </div>
        <div className={cn("mt-[0.7em] flex flex-col items-center pt-[0.9em] text-center text-[0.85em]", dashed)}>
          <QrCode className="size-[8em]" />
          <p className="mt-[0.4em]">Scan to pay · {invoice.upi.id}</p>
          <p className="mt-[0.6em] text-[#7a8090]">Thank you, visit again</p>
        </div>
      </article>
    </div>
  )
}
