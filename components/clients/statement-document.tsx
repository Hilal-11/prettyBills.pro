import type { CSSProperties } from "react"
import { cn } from "cn"

import { formatDate } from "@/lib/billing/dates"
import type { Statement } from "@/lib/billing/ledger"
import { formatINR } from "@/lib/billing/money"
import type { Client } from "@/lib/invoice/defaults"
import { stateLabel } from "@/lib/invoice/config"
import type { Address, BusinessSnapshot } from "@/lib/invoice/types"

export type StatementData = { business: BusinessSnapshot | null; client: Client; statement: Statement; generatedOn: string }

const numeric = "tabular-nums [font-feature-settings:'tnum']"

/**
 * Statement of account as an A4 document (for the PDF): business block,
 * client block, period, a summary box and the ledger with a running balance.
 * Sized in em off the container width like the invoice templates.
 */
export function StatementDocument({ data }: { data: StatementData }) {
  const { business, client, statement: s } = data
  const style = { "--ink": "#111318", "--muted": "#4b5160", "--rule": "#e3e5ea", "--strong": "#111318", fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" } as CSSProperties
  return (
    <div className="@container w-full">
      <article className="flex min-h-[141.4cqw] flex-col bg-white px-[3em] pt-[3em] pb-[2em] text-[length:1.6cqw] leading-[1.5] text-(--ink)" style={style}>
        <header className="flex items-start justify-between gap-[2em]">
          <div>
            <h1 className="text-[2em] leading-none font-bold tracking-[-0.02em]">Statement of Account</h1>
            <p className="mt-[0.5em] text-(--muted)">
              {formatDate(s.from)} – {formatDate(s.to)} · Generated {formatDate(data.generatedOn)}
            </p>
          </div>
          {business?.logo?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, sized in em
            <img src={business.logo.url} alt={`${business.name} logo`} className="h-[3.4em] w-auto max-w-[12em] object-contain" />
          ) : null}
        </header>

        <div className="mt-[2em] grid grid-cols-2 gap-[2em] text-[0.92em]">
          <Party title="From" name={business?.name || "Your business"} gstin={business?.gstin} address={business?.address} email={business?.email} phone={business?.phone} />
          <Party title="To" name={client.name} gstin={client.gstin} address={client.address} email={client.email} phone={client.phone} />
        </div>

        <dl className={cn("mt-[2em] grid grid-cols-4 overflow-hidden rounded-[0.5em] border border-(--rule) text-[0.9em]", numeric)}>
          {(
            [
              ["Opening balance", s.opening],
              ["Invoiced", s.invoiced],
              ["Received", s.received],
              ["Closing balance", s.closing],
            ] as const
          ).map(([k, v], i) => (
            <div key={k} className={cn("px-[1em] py-[0.8em]", i > 0 && "border-l border-(--rule)", i === 3 && "bg-[#f6f7f9]")}>
              <dt className="text-(--muted)">{k}</dt>
              <dd className={cn("mt-[0.1em] font-semibold", i === 3 && "text-[1.15em] font-bold")}>{formatINR(v)}</dd>
            </div>
          ))}
        </dl>

        <table className={cn("mt-[2em] w-full border-collapse text-[0.86em]", numeric)}>
          <thead>
            <tr className="border-b-[0.12em] border-(--strong) text-left text-(--muted)">
              <th className="w-[7.5em] pb-[0.5em] font-medium">Date</th>
              <th className="w-[5.5em] pb-[0.5em] font-medium">Type</th>
              <th className="w-[9.5em] pb-[0.5em] font-medium">Number</th>
              <th className="pb-[0.5em] font-medium">Description</th>
              <th className="w-[7.5em] pb-[0.5em] text-right font-medium">Debit</th>
              <th className="w-[7.5em] pb-[0.5em] text-right font-medium">Credit</th>
              <th className="w-[8em] pb-[0.5em] text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-(--rule)">
              <td className="py-[0.5em]">{formatDate(s.from)}</td>
              <td colSpan={5} className="py-[0.5em] font-semibold">
                Opening balance
              </td>
              <td className="py-[0.5em] text-right font-semibold">{formatINR(s.opening)}</td>
            </tr>
            {s.rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} className="border-b border-(--rule) align-top">
                <td className="py-[0.5em]">{formatDate(r.date)}</td>
                <td className="py-[0.5em]">{r.kind === "invoice" ? "Invoice" : "Payment"}</td>
                <td className="py-[0.5em]">{r.number}</td>
                <td className="py-[0.5em] pr-[1em] text-(--muted)">{r.description}</td>
                <td className="py-[0.5em] text-right">{r.debit ? formatINR(r.debit) : ""}</td>
                <td className="py-[0.5em] text-right">{r.credit ? formatINR(r.credit) : ""}</td>
                <td className="py-[0.5em] text-right">{formatINR(r.balance)}</td>
              </tr>
            ))}
            <tr className="border-t-[0.12em] border-(--strong)">
              <td className="py-[0.6em]">{formatDate(s.to)}</td>
              <td colSpan={5} className="py-[0.6em] font-bold">
                Closing balance
              </td>
              <td className="py-[0.6em] text-right font-bold">{formatINR(s.closing)}</td>
            </tr>
          </tbody>
        </table>

        <footer className="mt-auto flex justify-between gap-[1em] border-t border-(--rule) pt-[1em] text-[0.78em] text-(--muted)">
          <span>This is a computer-generated statement.</span>
          <span>{business?.name}</span>
        </footer>
      </article>
    </div>
  )
}

function Party({ title, name, gstin, address, email, phone }: { title: string; name: string; gstin?: string; address?: Address; email?: string; phone?: string }) {
  const city = address ? [address.city, [stateLabel(address.stateCode).replace(/ \(\d+\)$/, ""), address.pin].filter(Boolean).join(" ")].filter(Boolean).join(", ") : ""
  return (
    <div>
      <p className="text-[0.82em] font-semibold tracking-[0.06em] text-(--muted) uppercase">{title}</p>
      <p className="mt-[0.2em] font-semibold">{name}</p>
      {address?.line1 && <p>{address.line1}</p>}
      {address?.line2 && <p>{address.line2}</p>}
      {city && <p>{city}</p>}
      {gstin && <p>GSTIN {gstin}</p>}
      {email && <p>{email}</p>}
      {phone && <p>{phone}</p>}
    </div>
  )
}
