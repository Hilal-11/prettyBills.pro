"use client"

import { PercentIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TAX_RATES, stateLabel } from "@/lib/invoice/config"
import { uid } from "@/lib/invoice/format"
import { amountInWords, formatMoney } from "@/lib/invoice/totals"

import { Field, MoneyInput, NumberInput, Segmented, SelectField, TextField, ToggleRow } from "../fields"
import { SectionCard } from "../section-card"
import type { EditorApi } from "../use-editor"

export function TaxSection({ ed }: { ed: EditorApi }) {
  const inv = ed.invoice
  const t = ed.totals
  const explain =
    t.mode === "export"
      ? { title: "Zero-rated (export)", body: "No GST is charged on exports under LUT or bond." }
      : t.mode === "intra"
        ? { title: "Intra-state: CGST + SGST (half each)", body: `Your business and the place of supply are both in ${stateLabel(inv.placeOfSupply) || "the same state"}.` }
        : { title: "Inter-state: IGST", body: `Your business is in ${stateLabel(inv.from.address.stateCode) || "—"}; supply is to ${stateLabel(inv.placeOfSupply) || "—"}.` }

  const disc = inv.invoiceDiscount
  return (
    <SectionCard ed={ed} id="tax" icon={PercentIcon} title="Tax & totals" summary={`${t.mode === "intra" ? "CGST + SGST" : t.mode === "inter" ? "IGST" : "Export"} · Total ${formatMoney(t.total, { whole: true })}`}>
      <div className="rounded-lg border bg-background/60 p-3">
        <p className="text-[13px] font-semibold">{explain.title}</p>
        <p className="mt-0.5 text-xs text-foreground/70">{explain.body}</p>
        {t.taxRows.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs tabular-nums">
            {t.taxRows.map((r) => (
              <li key={`${r.kind}${r.rate}`} className="flex justify-between">
                <span>
                  {r.kind} {r.rate}% on {formatMoney(r.taxable)}
                </span>
                <span>{formatMoney(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label="Invoice discount" help="Applied before tax and spread across lines by value">
        <div className="flex items-center gap-2">
          {disc?.kind === "amount" ? (
            <MoneyInput field="invoiceDiscount" className="flex-1" value={disc.value} onChange={(v) => ed.update((d) => void (d.invoiceDiscount = { kind: "amount", value: v }), "invoiceDiscount")} />
          ) : (
            <NumberInput
              field="invoiceDiscount"
              className="flex-1"
              decimals={2}
              suffix="%"
              value={disc?.value ?? 0}
              onChange={(v) => ed.update((d) => void (d.invoiceDiscount = v ? { kind: "percent", value: Math.min(100, v) } : undefined), "invoiceDiscount")}
            />
          )}
          <Segmented
            label="Discount type"
            layoutId="inv-disc"
            value={disc?.kind ?? "percent"}
            options={[
              { value: "percent", label: "%" },
              { value: "amount", label: "₹" },
            ]}
            onChange={(k) => ed.update((d) => void (d.invoiceDiscount = { kind: k, value: 0 }))}
          />
        </div>
      </Field>

      <div className="space-y-2">
        <p className="text-[13px] font-medium text-foreground/90">Additional charges</p>
        {inv.charges.map((c) => (
          <div key={c.id} className="grid grid-cols-[1.3fr_1fr_0.8fr_auto] items-start gap-2">
            <TextField
              field={`charges.${c.id}.label`}
              placeholder="Shipping"
              aria-label="Charge name"
              value={c.label}
              error={ed.errorFor(`charges.${c.id}.label`)}
              onBlur={() => ed.touch(`charges.${c.id}.label`)}
              onChange={(v) => ed.update((d) => void (d.charges.find((x) => x.id === c.id)!.label = v), `charges.${c.id}.label`)}
            />
            <MoneyInput field={`charges.${c.id}.amount`} aria-label="Charge amount" value={c.amount} onChange={(v) => ed.update((d) => void (d.charges.find((x) => x.id === c.id)!.amount = v), `charges.${c.id}.amount`)} />
            <SelectField
              field={`charges.${c.id}.tax`}
              value={String(c.taxRate)}
              options={TAX_RATES.filter((r) => r.category === "taxable").map((r) => ({ value: r.value, label: r.label }))}
              onChange={(v) => ed.update((d) => void (d.charges.find((x) => x.id === c.id)!.taxRate = Number(v)))}
            />
            <Button variant="ghost" size="icon-sm" aria-label="Remove charge" className="mt-1 text-foreground/60 hover:text-destructive" onClick={() => ed.update((d) => void (d.charges = d.charges.filter((x) => x.id !== c.id)))}>
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => ed.update((d) => void d.charges.push({ id: uid("ch"), label: "", amount: 0, taxRate: 18 }))}>
          <PlusIcon /> Add charge (shipping, packaging…)
        </Button>
      </div>

      <div className="divide-y rounded-lg border">
        <ToggleRow label="TCS" hint="Tax collected at source, added after the total" checked={!!inv.tcs} onChange={(on) => ed.update((d) => void (d.tcs = on ? { rate: 0.1 } : undefined))} />
        {inv.tcs && (
          <div className="px-3 py-2.5">
            <Field label="TCS rate" error={ed.validation.errors["tcs.rate"]}>
              <NumberInput field="tcs.rate" decimals={3} suffix="%" value={inv.tcs.rate} onChange={(v) => ed.update((d) => void (d.tcs = { rate: v }), "tcs")} />
            </Field>
          </div>
        )}
        <ToggleRow label="Round off" hint={t.roundOff ? `Round off ${formatMoney(t.roundOff, { sign: true })}` : "Rounds the total to the nearest rupee"} checked={inv.roundOff} onChange={(v) => ed.update((d) => void (d.roundOff = v))} />
        <ToggleRow label="Amount in words" hint={amountInWords(t.total)} checked={inv.showAmountInWords} onChange={(v) => ed.update((d) => void (d.showAmountInWords = v))} />
      </div>
    </SectionCard>
  )
}
