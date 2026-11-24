import { cn } from "cn"

import { formatINR, invoiceTotals, taxLines, type SampleInvoice } from "@/lib/landing/invoice"
import type { qrPath } from "@/lib/landing/qr"

/**
 * "Standard": the default, recommended template. A plain, document-style
 * layout (title + meta block, parties, one big amount line, ruled item table,
 * right-aligned totals) in two kinds:
 * - invoice: "₹X due <date>", Pay online + UPI QR
 * - receipt: "₹X paid on <date>" and a payment history table
 * Sized in `em` off the container width like every other template.
 */

type Totals = ReturnType<typeof invoiceTotals>
type Qr = ReturnType<typeof qrPath>

const ink = "text-[#111318]"
const muted = "text-[#4b5160]"
const numeric = "tabular-nums [font-feature-settings:'tnum']"

export function StandardTemplate({ invoice, totals, fill, qr }: { invoice: SampleInvoice; totals: Totals; fill: boolean; qr: Qr }) {
  const receipt = invoice.kind === "receipt"
  const paidDate = invoice.receipt?.paidDate ?? invoice.issueDate
  const amount = formatINR(totals.total)
  const headline = receipt ? `${amount} paid on ${paidDate}` : `${amount} due ${invoice.dueDate}`
  const sacs = [...new Set(invoice.items.map((i) => i.sac).filter(Boolean))].join(", ")

  const meta: [string, string][] = receipt
    ? [
        ["Invoice number", invoice.number],
        ["Receipt number", invoice.receipt?.number ?? "—"],
        ["Date paid", paidDate],
        ["GSTIN", invoice.from.gstin],
      ]
    : [
        ["Invoice number", invoice.number],
        ["Date of issue", invoice.issueDate],
        ["Date due", invoice.dueDate],
        ["GSTIN", invoice.from.gstin],
      ]

  return (
    <article
      className={cn(
        "flex flex-col bg-white px-[3em] pt-[3em] pb-[2em] text-[length:2.05cqw] leading-[1.5] select-none",
        ink,
        fill && "min-h-[141.4cqw]"
      )}
      style={{ fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* title + mark */}
      <header className="flex items-start justify-between">
        <h1 className="text-[2.1em] leading-none font-bold tracking-[-0.02em]">{receipt ? "Receipt" : "Invoice"}</h1>
        <Mark name={invoice.from.name} />
      </header>

      <dl className="mt-[1.6em] grid w-fit grid-cols-[auto_auto] gap-x-[1.4em] gap-y-[0.15em] text-[0.92em]">
        {meta.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-semibold">{k}</dt>
            <dd className={cn("font-medium", numeric)}>{v}</dd>
          </div>
        ))}
      </dl>

      {/* parties */}
      <div className="mt-[2.2em] grid grid-cols-2 gap-[2em] text-[0.92em]">
        <Party title={invoice.from.name} lines={invoice.from.address ?? [`${invoice.from.city}, ${invoice.from.state}`]} email={invoice.from.email} />
        <Party
          label="Bill to"
          title={invoice.billTo.name}
          lines={[...(invoice.billTo.address ?? [`${invoice.billTo.city}, ${invoice.billTo.state}`]), `Place of supply: ${invoice.placeOfSupply}`]}
          email={invoice.billTo.email}
        />
      </div>

      {/* amount line */}
      <p className={cn("mt-[2.2em] text-[1.55em] font-bold tracking-[-0.01em]", numeric)}>{headline}</p>

      {!receipt && (invoice.display?.payNow !== false || invoice.display?.showQr !== false) && (
        <div className="mt-[0.9em] flex items-center gap-[1.4em]">
          {invoice.display?.showQr !== false && (
            <div className="flex items-center gap-[0.8em]">
              <svg viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" className="size-[4.2em] rounded-[0.15em] border border-[#e3e5ea] bg-white p-[0.2em]">
                <path d={qr.d} fill="#111" />
              </svg>
              <span className="text-[0.85em] leading-tight">
                <span className="block font-semibold">Scan to pay with UPI</span>
                <span className={muted}>{invoice.upi.id}</span>
              </span>
            </div>
          )}
          {invoice.display?.payNow !== false && <span className="text-[0.9em] font-medium text-[#3b5bdb] underline underline-offset-[0.2em]">Pay online</span>}
        </div>
      )}

      {/* items */}
      <table className={cn("mt-[2.4em] w-full border-collapse text-[0.9em]", numeric)}>
        <thead>
          <tr className="border-b-[0.12em] border-[#111318] text-[0.85em] text-[#3b4252]">
            <th className="pb-[0.5em] text-left font-medium">Description</th>
            <th className="w-[4em] pb-[0.5em] text-right font-medium">Qty</th>
            <th className="w-[7em] pb-[0.5em] text-right font-medium">Unit price</th>
            <th className="w-[4.5em] pb-[0.5em] text-right font-medium">Tax</th>
            <th className="w-[7em] pb-[0.5em] text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {totals.lines.map((line, i) => (
            <tr key={line.id ?? `${i}-${line.name}`} className="align-top">
              <td className="pt-[0.8em]">
                {line.name || "—"}
                {line.sac && <span className={cn("block text-[0.88em]", muted)}>SAC {line.sac}</span>}
              </td>
              <td className="pt-[0.8em] text-right">{line.qty}</td>
              <td className="pt-[0.8em] text-right">{formatINR(line.rate)}</td>
              <td className="pt-[0.8em] text-right">{invoice.tax.rate}%</td>
              <td className="pt-[0.8em] text-right">{formatINR(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className={cn("mt-[1.8em] ml-auto w-[55%] text-[0.9em]", numeric)}>
        <TotalRow label="Subtotal" value={formatINR(totals.subtotal)} />
        <TotalRow label="Total excluding tax" value={formatINR(totals.subtotal)} />
        {taxLines(invoice, totals.tax).map((t) => (
          <TotalRow key={t.label} label={`${t.label.replace(/ ([\d.]+%)$/, " ($1 on ")}${formatINR(totals.subtotal)})`} value={formatINR(t.amount)} />
        ))}
        <TotalRow label="Total" value={amount} />
        <TotalRow label={receipt ? "Amount paid" : "Amount due"} value={amount} strong />
      </div>

      {/* payment history (receipt) */}
      {receipt && (
        <section className="mt-[2.4em]">
          <h2 className="text-[1.3em] font-bold tracking-[-0.01em]">Payment history</h2>
          <table className={cn("mt-[1em] w-full border-collapse text-[0.9em]", numeric)}>
            <thead>
              <tr className="border-b-[0.12em] border-[#111318] text-[0.85em] text-[#3b4252]">
                <th className="pb-[0.5em] text-left font-medium">Payment method</th>
                <th className="pb-[0.5em] text-left font-medium">Date</th>
                <th className="pb-[0.5em] text-right font-medium">Amount paid</th>
                <th className="pb-[0.5em] text-right font-medium">Receipt number</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pt-[0.8em]">{invoice.receipt?.method ?? "UPI"}</td>
                <td className="pt-[0.8em]">{paidDate}</td>
                <td className="pt-[0.8em] text-right">{amount}</td>
                <td className="pt-[0.8em] text-right">{invoice.receipt?.number ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* notes */}
      <div className="mt-[2.4em] space-y-[0.1em] text-[0.9em]">
        {sacs && <p>SAC / HSN: {sacs}</p>}
        <p>Tax invoice{invoice.tax.type === "IGST" ? " · Inter-state supply" : " · Intra-state supply"}</p>
        {invoice.notes && <p className={cn("mt-[0.8em] whitespace-pre-line", muted)}>{invoice.notes}</p>}
      </div>

      {/* page footer */}
      <footer className={cn("mt-auto flex justify-between border-t border-[#e3e5ea] pt-[1em] text-[0.78em]", muted, fill ? "" : "mt-[3em]")}>
        <span className={numeric}>
          {invoice.number} · {headline}
        </span>
        <span>Page 1 of 1</span>
      </footer>
    </article>
  )
}

function Party({ label, title, lines, email }: { label?: string; title: string; lines: string[]; email?: string }) {
  return (
    <div>
      {label && <p className="font-semibold">{label}</p>}
      <p className={cn(label ? "" : "font-semibold")}>{title}</p>
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
      {email && <p>{email}</p>}
    </div>
  )
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between border-t border-[#e3e5ea] py-[0.3em]", strong && "border-[#111318] font-bold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/** Business mark, top right: initials, in the seller's own brand (no logo yet). */
function Mark({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
  return <span className="grid size-[2.4em] place-items-center rounded-[0.4em] bg-[#111318] text-[1.05em] font-bold tracking-[-0.03em] text-white">{initials}</span>
}
