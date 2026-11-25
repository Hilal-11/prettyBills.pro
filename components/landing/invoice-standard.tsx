import type { CSSProperties, ReactNode } from "react"
import { cn } from "cn"

import { currencySymbol, PAYMENT_TERMS, SIGNATURE_FONTS, stateLabel } from "@/lib/invoice/config"
import { formatDate } from "@/lib/invoice/format"
import { amountInWords, formatMoney, type Totals } from "@/lib/invoice/totals"
import type { Address, Invoice } from "@/lib/invoice/types"
import type { qrPath } from "@/lib/landing/qr"

/**
 * "Folio" (slug `standard`): the default, recommended template. A plain,
 * document-style layout that prints every field the editor supports.
 * Sized in `em` off the container width like every other template.
 * Regions are tagged with `data-region` so the editor can link preview ⇄ form.
 */

type Qr = ReturnType<typeof qrPath>

const numeric = "tabular-nums [font-feature-settings:'tnum']"

const pages = {
  white: { "--paper": "#ffffff", "--ink": "#111318", "--muted": "#4b5160", "--rule": "#e3e5ea", "--strong-rule": "#111318", "--link": "#3b5bdb" },
  black: { "--paper": "#0b0b0c", "--ink": "#f5f5f6", "--muted": "rgb(255 255 255 / 0.65)", "--rule": "rgb(255 255 255 / 0.15)", "--strong-rule": "rgb(255 255 255 / 0.7)", "--link": "#8fb0ff" },
} as const

/** Footer text shared by the preview footer and the PDF page footer. */
export function footerText(invoice: Invoice, totals: Totals) {
  if (invoice.footer) return invoice.footer
  const money = formatMoney(invoice.status === "paid" ? totals.total : totals.balanceDue, { whole: true, symbol: currencySymbol(invoice.currency) })
  return `${invoice.number} · ${invoice.status === "paid" ? `${money} paid` : `${money} due ${formatDate(invoice.dueDate, invoice.dateFormat)}`}`
}

export function StandardTemplate({ invoice, totals, fill, qr, kind = "invoice", print = false }: { invoice: Invoice; totals: Totals; fill: boolean; qr: Qr; kind?: "invoice" | "receipt"; print?: boolean }) {
  const black = invoice.pageColor === "black"
  const receipt = kind === "receipt"
  const symbol = currencySymbol(invoice.currency)
  const money = (p: number, o: Parameters<typeof formatMoney>[1] = {}) => formatMoney(p, { symbol, ...o })
  const date = (iso: string) => formatDate(iso, invoice.dateFormat)
  const cols = invoice.columns
  const headlineAmount = money(receipt ? totals.amountPaid || totals.total : totals.balanceDue, { whole: true })
  const headline = receipt
    ? `${headlineAmount} paid on ${date(invoice.issueDate)}`
    : invoice.status === "paid"
      ? `${money(totals.total, { whole: true })} paid`
      : `${headlineAmount} due ${date(invoice.dueDate)}`
  const terms = PAYMENT_TERMS.find((t) => t.value === invoice.paymentTerms)
  const logo = invoice.from.logo
  const sig = invoice.signature

  const meta: [string, string][] = [
    [receipt ? "Invoice number" : "Invoice number", invoice.number || "—"],
    [receipt ? "Date paid" : "Date of issue", date(invoice.issueDate)],
    ...(!receipt ? ([["Date due", date(invoice.dueDate)]] as [string, string][]) : []),
    ...(!receipt && terms && terms.value !== "custom" ? ([["Terms", terms.label]] as [string, string][]) : []),
    ...(invoice.poNumber ? ([["PO number", invoice.poNumber]] as [string, string][]) : []),
    ...(invoice.reference ? ([["Reference", invoice.reference]] as [string, string][]) : []),
  ]

  return (
    <article
      className={cn("flex flex-col bg-(--paper) px-[3em] pt-[3em] pb-[2em] text-[length:1.72cqw] leading-[1.5] text-(--ink) select-none", fill && "min-h-[141.4cqw]")}
      style={{ ...pages[black ? "black" : "white"], fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" } as CSSProperties}
    >
      {/* title + logo */}
      <header data-region="business" className={cn("flex items-start justify-between gap-[2em]", logo?.position === "left" && "flex-row-reverse")}>
        <div className={cn(logo?.position === "left" && "text-right")}>
          <h1 data-region="details" className="text-[2.1em] leading-none font-bold tracking-[-0.02em]">
            {receipt ? "Receipt" : invoice.title}
          </h1>
          {invoice.status === "paid" && !receipt && (
            <span className="mt-[0.6em] inline-block rounded-[0.3em] border border-[#12805c] px-[0.5em] text-[0.8em] font-bold tracking-[0.1em] text-[#12805c]">PAID</span>
          )}
        </div>
        <Logo invoice={invoice} black={black} />
      </header>

      <div className="mt-[1.6em] flex flex-wrap gap-x-[3em] gap-y-[0.8em]">
        <dl data-region="details" className="grid w-fit grid-cols-[auto_auto] gap-x-[1.4em] gap-y-[0.15em] text-[0.92em]">
          {meta.map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
          {invoice.reverseCharge && <Row k="Reverse charge" v="Yes" />}
        </dl>
        {invoice.customFields.some((c) => c.label && c.value) && (
          <dl data-region="more" className="grid w-fit grid-cols-[auto_auto] gap-x-[1.4em] gap-y-[0.15em] text-[0.92em]">
            {invoice.customFields
              .filter((c) => c.label && c.value)
              .map((c) => (
                <Row key={c.id} k={c.label} v={c.value} />
              ))}
          </dl>
        )}
      </div>

      {/* parties */}
      <div className={cn("mt-[2.2em] grid gap-[2em] text-[0.92em]", invoice.shipTo ? "grid-cols-3" : "grid-cols-2")}>
        <div data-region="business">
          <p className="font-semibold">{invoice.from.name || "Your business"}</p>
          {invoice.from.legalName && invoice.from.legalName !== invoice.from.name && <p className="text-(--muted)">{invoice.from.legalName}</p>}
          <AddressLines a={invoice.from.address} />
          {invoice.from.gstin && <p>GSTIN {invoice.from.gstin}</p>}
          {invoice.from.pan && !invoice.from.gstin && <p>PAN {invoice.from.pan}</p>}
          {invoice.from.email && <p>{invoice.from.email}</p>}
          {invoice.from.phone && <p>{invoice.from.phone}</p>}
          {invoice.from.website && <p>{invoice.from.website}</p>}
        </div>
        <div data-region="client">
          <p className="font-semibold">Bill to</p>
          <p>{invoice.billTo.name || "—"}</p>
          <AddressLines a={invoice.billTo.address} />
          {invoice.billTo.gstin && <p>GSTIN {invoice.billTo.gstin}</p>}
          {invoice.billTo.email && <p>{invoice.billTo.email}</p>}
          {invoice.billTo.phone && <p>{invoice.billTo.phone}</p>}
          <p className="mt-[0.4em] text-(--muted)">Place of supply: {stateLabel(invoice.placeOfSupply) || "—"}</p>
          {invoice.supplyType === "export" && invoice.lut && <p className="text-(--muted)">LUT / bond: {invoice.lut}</p>}
        </div>
        {invoice.shipTo && (
          <div data-region="client">
            <p className="font-semibold">Ship to</p>
            <p>{invoice.shipTo.name}</p>
            <AddressLines a={invoice.shipTo} />
          </div>
        )}
      </div>

      {/* amount line */}
      <p data-region="tax" className={cn("mt-[2.2em] text-[1.55em] font-bold tracking-[-0.01em]", numeric)}>
        {headline}
      </p>

      {!receipt && invoice.status !== "paid" && (invoice.payment.showUpiQr || invoice.payment.paymentLink) && (
        <div data-region="payment" className="mt-[0.9em] flex items-center gap-[1.4em]">
          {invoice.payment.showUpiQr && invoice.payment.upiId && (
            <div className="flex items-center gap-[0.8em]">
              <QrTile qr={qr} />
              <span className="text-[0.85em] leading-tight">
                <span className="block font-semibold">Scan to pay with UPI</span>
                <span className="text-(--muted)">{invoice.payment.upiId}</span>
              </span>
            </div>
          )}
          {invoice.payment.paymentLink && <span className="text-[0.9em] font-medium text-(--link) underline underline-offset-[0.2em]">Pay online</span>}
        </div>
      )}

      {/* items */}
      <table data-region="items" className={cn("mt-[2.4em] w-full border-collapse text-[0.9em]", numeric)}>
        <thead>
          <tr className="border-b-[0.12em] border-(--strong-rule) text-[0.85em] text-(--muted)">
            <th className="pb-[0.5em] text-left font-medium">Description</th>
            {cols.hsn && <th className="w-[5.5em] pb-[0.5em] text-left font-medium">HSN/SAC</th>}
            <th className="w-[4.5em] pb-[0.5em] text-right font-medium">Qty</th>
            <th className="w-[6.5em] pb-[0.5em] text-right font-medium">Unit price</th>
            {cols.discount && <th className="w-[5em] pb-[0.5em] text-right font-medium">Disc.</th>}
            {cols.tax && <th className="w-[3.5em] pb-[0.5em] text-right font-medium">Tax</th>}
            <th className="w-[7em] pb-[0.5em] text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => {
            const t = totals.lines[i]
            const taxLabel = item.taxCategory === "exempt" ? "Exempt" : item.taxCategory === "nil" ? "Nil" : `${item.taxRate}%`
            return (
              <tr key={item.id} data-item={item.id} className="align-top">
                <td className="pt-[0.8em] pr-[1em]">
                  {item.name || "—"}
                  {item.description && <span className="block text-[0.88em] whitespace-pre-line text-(--muted)">{item.description}</span>}
                </td>
                {cols.hsn && <td className="pt-[0.8em] text-(--muted)">{item.hsnSac}</td>}
                <td className="pt-[0.8em] text-right">
                  {item.qty}
                  {cols.unit && item.unit && <span className="text-(--muted)"> {item.unit}</span>}
                </td>
                <td className="pt-[0.8em] text-right">{money(item.rate)}</td>
                {cols.discount && <td className="pt-[0.8em] text-right">{t?.lineDiscount ? `−${money(t.lineDiscount)}` : "—"}</td>}
                {cols.tax && <td className="pt-[0.8em] text-right">{taxLabel}</td>}
                <td className="pt-[0.8em] text-right">{money(t?.base ?? 0)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* totals */}
      <div data-region="tax" className={cn("mt-[1.8em] ml-auto w-[58%] text-[0.9em]", numeric)}>
        <TotalRow label="Subtotal" value={money(totals.subtotal)} />
        {totals.invoiceDiscount > 0 && <TotalRow label="Discount" value={`−${money(totals.invoiceDiscount)}`} />}
        {totals.charges.map((c) => (
          <TotalRow key={c.id} label={c.label || "Charge"} value={money(c.amount)} />
        ))}
        {totals.showTotalExclTax && <TotalRow label="Total excluding tax" value={money(totals.taxableTotal + totals.chargesTotal)} />}
        {totals.taxRows.map((r) => (
          <TotalRow key={`${r.kind}-${r.rate}`} label={`${r.kind} ${r.rate}% on ${money(r.taxable)}`} value={money(r.amount)} />
        ))}
        {totals.mode === "export" && <TotalRow label="IGST (zero-rated export)" value={money(0)} />}
        {totals.tcs > 0 && <TotalRow label={`TCS ${invoice.tcs?.rate}%`} value={money(totals.tcs)} />}
        {invoice.roundOff && totals.roundOff !== 0 && <TotalRow label="Round off" value={money(totals.roundOff, { sign: true })} />}
        <TotalRow label="Total" value={money(totals.total)} strong={totals.amountPaid === 0} />
        {totals.amountPaid > 0 && (
          <>
            <TotalRow label="Amount paid" value={`−${money(totals.amountPaid)}`} />
            <TotalRow label="Balance due" value={money(totals.balanceDue)} strong />
          </>
        )}
        {totals.amountPaid === 0 && !receipt && invoice.status !== "paid" && <TotalRow label="Amount due" value={money(totals.balanceDue)} strong />}
      </div>

      {invoice.showAmountInWords && invoice.currency === "INR" && (
        <p data-region="tax" className="mt-[1em] text-right text-[0.85em] text-(--muted)">
          {amountInWords(totals.total)}
        </p>
      )}

      {/* payment details */}
      {(invoice.payment.showBank || invoice.payment.instructions) && (
        <section data-region="payment" className="mt-[2em] text-[0.9em]">
          <p className="font-semibold">Payment details</p>
          {invoice.payment.showBank && invoice.payment.bank && (
            <dl className="mt-[0.3em] grid w-fit grid-cols-[auto_auto] gap-x-[1.4em]">
              <Row k="Account holder" v={invoice.payment.bank.holder} />
              <Row k="Account number" v={invoice.payment.bank.accountNumber} />
              <Row k="IFSC" v={invoice.payment.bank.ifsc} />
              {invoice.payment.bank.bankName && <Row k="Bank" v={[invoice.payment.bank.bankName, invoice.payment.bank.branch].filter(Boolean).join(", ")} />}
            </dl>
          )}
          {invoice.payment.instructions && <p className="mt-[0.4em] text-(--muted)">{invoice.payment.instructions}</p>}
        </section>
      )}

      {/* notes + terms */}
      <div data-region="notes" className="mt-[2em] space-y-[0.2em] text-[0.9em]">
        <p>Tax payable on reverse charge: {invoice.reverseCharge ? "Yes" : "No"}</p>
        {invoice.notes && <p className="mt-[0.6em] whitespace-pre-line">{invoice.notes}</p>}
        {invoice.terms && (
          <div className="mt-[0.8em]">
            <p className="font-semibold">Terms & conditions</p>
            <p className="whitespace-pre-line text-(--muted)">{invoice.terms}</p>
          </div>
        )}
      </div>

      {/* signature */}
      {sig?.show && (
        <div data-region="signature" className="mt-[2em] ml-auto flex w-[45%] flex-col items-end text-right text-[0.9em]">
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

      {/* page footer (PDFs draw their own, with real page numbers) */}
      {!print && (
      <footer data-region="notes" className={cn("flex justify-between gap-[1em] border-t border-(--rule) pt-[1em] text-[0.78em] text-(--muted)", fill ? "mt-auto" : "mt-[3em]")}>
        <span className={numeric}>
          {invoice.footer || `${invoice.number} · ${headline}`}
        </span>
        <span className="shrink-0">Page 1 of 1</span>
      </footer>
      )}
    </article>
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

function AddressLines({ a }: { a: Address }) {
  const cityLine = [a.city, [stateLabel(a.stateCode).replace(/ \(\d+\)$/, ""), a.pin].filter(Boolean).join(" ")].filter(Boolean).join(", ")
  return (
    <>
      {a.line1 && <p>{a.line1}</p>}
      {a.line2 && <p>{a.line2}</p>}
      {cityLine && <p>{cityLine}</p>}
      {a.country && <p>{a.country}</p>}
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

/** The QR always sits on a white tile so it stays scannable on a black page. */
function QrTile({ qr }: { qr: Qr }) {
  return (
    <svg viewBox={`-1.5 -1.5 ${qr.size + 3} ${qr.size + 3}`} shapeRendering="crispEdges" className="size-[4.6em] rounded-[0.2em] bg-white" role="img" aria-label="UPI payment QR code">
      <path d={qr.d} fill="#111" />
    </svg>
  )
}

function Logo({ invoice, black }: { invoice: Invoice; black: boolean }) {
  const logo = invoice.from.logo
  const size = { s: "h-[2.4em]", m: "h-[3.4em]", l: "h-[4.6em]" }[logo?.size ?? "m"]
  if (logo?.url) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", black && logo.lightTile && "rounded-[0.3em] bg-white p-[0.4em]")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, sized in em */}
        <img src={logo.url} alt={`${invoice.from.name} logo`} className={cn("w-auto max-w-[12em] object-contain", size)} />
      </span>
    )
  }
  const initials =
    invoice.from.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("") || "PB"
  return (
    <span className={cn("grid size-[2.4em] shrink-0 place-items-center rounded-[0.4em] text-[1.05em] font-bold tracking-[-0.03em]", black ? "bg-white text-[#0b0b0c]" : "bg-[#111318] text-white")}>
      {initials}
    </span>
  )
}
