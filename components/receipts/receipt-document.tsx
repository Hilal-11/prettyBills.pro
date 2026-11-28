import type { CSSProperties, ReactNode } from "react"
import { cn } from "cn"

import { templateLook } from "@/components/landing/invoice-document"
import { formatDate } from "@/lib/billing/dates"
import { MODE_LABEL } from "@/lib/billing/modes"
import { amountInWordsINR, formatINR } from "@/lib/billing/money"
import { tdsLabel } from "@/lib/billing/tds"
import type { ReceiptView } from "@/lib/data/types"
import { SIGNATURE_FONTS, stateLabel } from "@/lib/invoice/config"
import type { Address } from "@/lib/invoice/types"

/**
 * A payment receipt in the invoice's own look: same logo, page colour,
 * accent and signature as the invoice it pays, with a receipt body (amount
 * received, how it was paid, and what's left on the invoice).
 *
 * Sized in `em` off the container width, like the invoice templates, so the
 * same markup is a thumbnail, the on-screen preview and the A4 PDF.
 */

const numeric = "tabular-nums [font-feature-settings:'tnum']"

const pages = {
  white: { "--paper": "#ffffff", "--ink": "#111318", "--muted": "#4b5160", "--rule": "#e3e5ea", "--strong-rule": "#111318", "--tint": "#f6f7f9" },
  black: { "--paper": "#0b0b0c", "--ink": "#f5f5f6", "--muted": "rgb(255 255 255 / 0.65)", "--rule": "rgb(255 255 255 / 0.15)", "--strong-rule": "rgb(255 255 255 / 0.7)", "--tint": "rgb(255 255 255 / 0.05)" },
} as const

export function ReceiptDocument({ view, fill = false, print = false, invoiceHref, className }: { view: ReceiptView; fill?: boolean; print?: boolean; invoiceHref?: string | null; className?: string }) {
  const { receipt, payment, invoice, balance } = view
  const black = receipt.pageColor === "black"
  const look = templateLook(receipt.templateId)
  // a black accent disappears on a black page
  const accent = black && /^#(0|1)[0-9a-f]{5}$/i.test(look.accent) ? "#f5f5f6" : look.accent
  const voided = receipt.status === "void"
  const sig = invoice.signature
  const stamp = voided ? null : balance.paidInFull ? { text: "PAID IN FULL", color: "#12805c" } : { text: "PART PAYMENT", color: black ? "#8fb0ff" : "#2453d6" }
  const label = `Payment receipt ${receipt.number} from ${invoice.from.name} to ${invoice.billTo.name} for ${formatINR(payment.amount)}${payment.tdsPaise ? ` plus ${formatINR(payment.tdsPaise)} TDS` : ""}${voided ? ", void" : ""}`

  return (
    <div className={cn("@container w-full", className)} role="img" aria-label={label}>
      <article
        className={cn("relative isolate flex flex-col overflow-hidden bg-(--paper) px-[3em] pt-[3em] pb-[2em] text-[length:1.72cqw] leading-[1.5] text-(--ink)", fill && !print && "min-h-[141.4cqw]", print && "min-h-[141.4cqw]")}
        style={{ ...pages[black ? "black" : "white"], "--accent": accent, fontFamily: look.font } as unknown as CSSProperties}
      >
        {voided && (
          <span aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
            <span className="-rotate-[28deg] rounded-[0.15em] border-[0.12em] border-[#c92a2a]/40 px-[0.4em] text-[9em] leading-none font-black tracking-[0.08em] text-[#c92a2a]/20">VOID</span>
          </span>
        )}

        <header className={cn("relative flex items-start justify-between gap-[2em]", invoice.from.logo?.position === "left" && "flex-row-reverse")}>
          <div className={cn(invoice.from.logo?.position === "left" && "text-right")}>
            <h1 className="text-[2.1em] leading-none font-bold tracking-[-0.02em]">Payment Receipt</h1>
            <div className={cn("mt-[0.7em] flex flex-wrap items-center gap-[0.5em]", invoice.from.logo?.position === "left" && "justify-end")}>
              {stamp && (
                <span className="inline-block rounded-[0.3em] border-[0.12em] px-[0.55em] py-[0.05em] text-[0.8em] font-bold tracking-[0.12em]" style={{ borderColor: stamp.color, color: stamp.color }}>
                  {stamp.text}
                </span>
              )}
              {receipt.revision > 1 && <span className="rounded-[0.3em] bg-(--tint) px-[0.55em] py-[0.05em] text-[0.8em] font-semibold text-(--muted)">Revised</span>}
            </div>
          </div>
          <Logo view={view} black={black} />
        </header>

        <dl className="relative mt-[1.6em] grid w-fit grid-cols-[auto_auto] gap-x-[1.4em] gap-y-[0.15em] text-[0.92em]">
          <Row k="Receipt no." v={receipt.number} />
          <Row k="Receipt date" v={formatDate(receipt.date)} />
          <Row k="Against invoice" v={invoiceHref ? <a href={invoiceHref} className="underline underline-offset-[0.2em]">{invoice.number}</a> : invoice.number} />
          {receipt.revision > 1 && <Row k="Revision" v={String(receipt.revision)} />}
        </dl>

        <div className="relative mt-[2.2em] grid grid-cols-2 gap-[2em] text-[0.92em]">
          <div>
            <p className="text-[0.82em] font-semibold tracking-[0.06em] text-(--muted) uppercase">From</p>
            <p className="mt-[0.2em] font-semibold">{invoice.from.name || "Your business"}</p>
            {invoice.from.legalName && invoice.from.legalName !== invoice.from.name && <p className="text-(--muted)">{invoice.from.legalName}</p>}
            <AddressLines a={invoice.from.address} />
            {invoice.from.gstin && <p>GSTIN {invoice.from.gstin}</p>}
            {invoice.from.email && <p>{invoice.from.email}</p>}
            {invoice.from.phone && <p>{invoice.from.phone}</p>}
          </div>
          <div>
            <p className="text-[0.82em] font-semibold tracking-[0.06em] text-(--muted) uppercase">Received from</p>
            <p className="mt-[0.2em] font-semibold">{invoice.billTo.name || "—"}</p>
            <AddressLines a={invoice.billTo.address} />
            {invoice.billTo.gstin && <p>GSTIN {invoice.billTo.gstin}</p>}
            {invoice.billTo.email && <p>{invoice.billTo.email}</p>}
          </div>
        </div>

        <section className="relative mt-[2.2em] rounded-[0.5em] bg-(--tint) px-[1.4em] py-[1.2em]">
          <p className="text-[0.82em] font-semibold tracking-[0.06em] text-(--muted) uppercase">Amount received</p>
          <p className={cn("mt-[0.1em] text-[2.6em] leading-tight font-bold tracking-[-0.02em] text-(--accent)", numeric)}>{formatINR(payment.amount)}</p>
          <p className="text-[0.88em] text-(--muted)">{amountInWordsINR(payment.amount)}</p>
          {payment.tdsPaise > 0 && (
            // the client's TDS settles part of the invoice too
            <dl className={cn("mt-[0.9em] grid w-full max-w-[26em] gap-y-[0.15em] border-t border-(--rule) pt-[0.6em] text-[0.88em]", numeric)}>
              <div className="flex justify-between gap-[1em]">
                <dt>Amount received</dt>
                <dd>{formatINR(payment.amount)}</dd>
              </div>
              <div className="flex justify-between gap-[1em]">
                <dt>TDS deducted{payment.tdsSection ? ` (${tdsLabel(payment.tdsSection)})` : ""}</dt>
                <dd>{formatINR(payment.tdsPaise)}</dd>
              </div>
              <div className="flex justify-between gap-[1em] font-bold">
                <dt>Total settled</dt>
                <dd>{formatINR(payment.amount + payment.tdsPaise)}</dd>
              </div>
            </dl>
          )}
        </section>

        <div className="relative mt-[2em] grid grid-cols-2 gap-[2em] text-[0.9em]">
          <section>
            <p className="font-semibold">Payment details</p>
            <dl className="mt-[0.4em] grid w-fit grid-cols-[auto_auto] gap-x-[1.4em] gap-y-[0.15em]">
              <Row k="Mode" v={MODE_LABEL[payment.mode]} />
              {payment.reference && <Row k={payment.mode === "cheque" ? "Cheque no." : "Reference"} v={payment.reference} />}
              <Row k="Payment date" v={formatDate(payment.paidOn)} />
            </dl>
          </section>
          <section>
            <p className="font-semibold">Against invoice</p>
            <dl className="mt-[0.4em] grid w-fit grid-cols-[auto_auto] gap-x-[1.4em] gap-y-[0.15em]">
              <Row k="Invoice no." v={invoice.number} />
              <Row k="Invoice date" v={formatDate(invoice.issueDate)} />
              <Row k="Invoice total" v={formatINR(balance.total)} />
            </dl>
          </section>
        </div>

        <div className={cn("relative mt-[2em] ml-auto w-[58%] text-[0.9em]", numeric)}>
          <TotalRow label="Invoice total" value={formatINR(balance.total)} />
          <TotalRow label="Paid before this receipt" value={formatINR(balance.paidBefore)} />
          <TotalRow label={payment.tdsPaise > 0 ? "This receipt (incl. TDS)" : "This receipt"} value={formatINR(balance.thisPayment)} />
          <TotalRow label="Balance remaining" value={formatINR(balance.remaining)} strong />
        </div>

        {voided && receipt.voidReason && (
          <p className="relative mt-[1.4em] text-[0.88em] font-medium text-[#c92a2a]">This receipt was voided: {receipt.voidReason}</p>
        )}

        <div className="relative mt-auto pt-[2.4em]">
          {sig?.show && (
            <div className="ml-auto flex w-[45%] flex-col items-end text-right text-[0.9em]">
              <p>For {invoice.from.name}</p>
              <div className="relative my-[0.4em] flex h-[4.5em] items-center justify-end gap-[0.6em]">
                {sig.stampUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL, sized in em
                  <img src={sig.stampUrl} alt="" className="h-[4.5em] w-auto opacity-90" />
                )}
                {sig.kind === "type" ? (
                  <span className="text-[2.1em] leading-none" style={{ fontFamily: SIGNATURE_FONTS.find((f) => f.id === sig.font)?.cssVar ?? "cursive" }}>
                    {sig.typedName}
                  </span>
                ) : sig.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL, sized in em
                  <img src={sig.imageUrl} alt="Signature" className={cn("h-[4.5em] w-auto", black && "invert")} />
                ) : null}
              </div>
              {(sig.signatoryName || sig.designation) && <p>{[sig.signatoryName, sig.designation].filter(Boolean).join(", ")}</p>}
              <p className="text-(--muted)">{sig.label || "Authorised Signatory"}</p>
            </div>
          )}
          <p className="mt-[1.6em] text-[0.82em] text-(--muted)">This is a computer-generated receipt.</p>
          <footer className="mt-[0.8em] flex justify-between gap-[1em] border-t border-(--rule) pt-[1em] text-[0.78em] text-(--muted)">
            <span className={numeric}>{invoice.footer || `${receipt.number} · ${formatINR(payment.amount)} received ${formatDate(payment.paidOn)}`}</span>
            <span className="shrink-0">{invoice.from.name}</span>
          </footer>
        </div>
      </article>
    </div>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="contents">
      <dt className="font-semibold">{k}</dt>
      <dd className={cn("font-medium", numeric)}>{v}</dd>
    </div>
  )
}

function AddressLines({ a }: { a: Address | undefined }) {
  if (!a) return null
  const cityLine = [a.city, [stateLabel(a.stateCode).replace(/ \(\d+\)$/, ""), a.pin].filter(Boolean).join(" ")].filter(Boolean).join(", ")
  return (
    <>
      {a.line1 && <p>{a.line1}</p>}
      {a.line2 && <p>{a.line2}</p>}
      {cityLine && <p>{cityLine}</p>}
    </>
  )
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-[1em] border-t border-(--rule) py-[0.3em]", strong && "border-(--strong-rule) font-bold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Logo({ view, black }: { view: ReceiptView; black: boolean }) {
  const { from } = view.invoice
  const logo = from.logo
  const size = { s: "h-[2.4em]", m: "h-[3.4em]", l: "h-[4.6em]" }[logo?.size ?? "m"]
  if (logo?.url) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", black && logo.lightTile && "rounded-[0.3em] bg-white p-[0.4em]")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, sized in em */}
        <img src={logo.url} alt={`${from.name} logo`} className={cn("w-auto max-w-[12em] object-contain", size)} />
      </span>
    )
  }
  const initials =
    (from.name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("") || "PB"
  return <span className={cn("grid size-[2.4em] shrink-0 place-items-center rounded-[0.4em] text-[1.05em] font-bold tracking-[-0.03em]", black ? "bg-white text-[#0b0b0c]" : "bg-[#111318] text-white")}>{initials}</span>
}
