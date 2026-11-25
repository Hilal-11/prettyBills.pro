"use client"

import * as React from "react"
import { FileTextIcon, LockIcon, LockOpenIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { CURRENCIES, INVOICE_TITLES, PAYMENT_TERMS } from "@/lib/invoice/config"
import { addDays, formatDate } from "@/lib/invoice/format"
import type { PaymentTerms } from "@/lib/invoice/types"

import { DateField, Field, NumberInput, SelectField, TextField, ToggleRow } from "../fields"
import { SectionCard } from "../section-card"
import type { EditorApi } from "../use-editor"

export function DetailsSection({ ed }: { ed: EditorApi }) {
  const inv = ed.invoice
  const [unlocked, setUnlocked] = React.useState(false)
  const [confirm, setConfirm] = React.useState(false)
  const locked = !!inv.sentAt && !unlocked
  const err = (p: string) => ed.errorFor(p)

  const termDays = (t: PaymentTerms) => PAYMENT_TERMS.find((x) => x.value === t)?.days

  return (
    <SectionCard ed={ed} id="details" icon={FileTextIcon} title="Invoice details" summary={`${inv.number} · due ${formatDate(inv.dueDate, inv.dateFormat)}`}>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Invoice number"
          required
          className="col-span-2"
          htmlFor="f-number"
          error={err("number") ?? (ed.validation.errors.number?.includes("already") ? ed.validation.errors.number : undefined)}
          help={locked ? "Locked because this invoice was sent" : "Prefix / financial year / counter"}
          aside={
            inv.sentAt ? (
              <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={() => (unlocked ? setUnlocked(false) : setConfirm(true))}>
                {unlocked ? <LockOpenIcon className="size-3" /> : <LockIcon className="size-3" />}
                {unlocked ? "Lock" : "Unlock"}
              </Button>
            ) : null
          }
        >
          <TextField
            field="number"
            id="f-number"
            readOnly={locked}
            value={inv.number}
            error={err("number")}
            onBlur={() => ed.touch("number")}
            onChange={(v) => ed.update((d) => void (d.number = v), "number")}
            className="tabular-nums read-only:bg-muted/50"
          />
        </Field>

        <Field label="Issue date" required error={err("issueDate")}>
          <DateField
            field="issueDate"
            value={inv.issueDate}
            format={inv.dateFormat}
            onChange={(iso) =>
              ed.update((d) => {
                d.issueDate = iso
                const days = termDays(d.paymentTerms)
                if (days != null) d.dueDate = addDays(iso, days)
              })
            }
          />
        </Field>
        <Field label="Payment terms">
          <SelectField
            field="paymentTerms"
            value={inv.paymentTerms}
            options={PAYMENT_TERMS.map((t) => ({ value: t.value, label: t.label }))}
            onChange={(v) =>
              ed.update((d) => {
                d.paymentTerms = v as PaymentTerms
                const days = termDays(d.paymentTerms)
                if (days != null) d.dueDate = addDays(d.issueDate, days)
              })
            }
          />
        </Field>
        <Field label="Due date" required error={err("dueDate") ?? ed.validation.errors.dueDate} help="Editing it by hand sets terms to Custom" className="col-span-2">
          <DateField
            field="dueDate"
            value={inv.dueDate}
            min={inv.issueDate}
            format={inv.dateFormat}
            onChange={(iso) =>
              ed.update((d) => {
                d.dueDate = iso
                d.paymentTerms = "custom"
              })
            }
          />
        </Field>

        <Field label="PO / order number" help="Printed only when filled">
          <TextField field="poNumber" value={inv.poNumber} onChange={(v) => ed.update((d) => void (d.poNumber = v), "poNumber")} />
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
          <Field label={`1 ${inv.currency} = ₹`} required error={ed.validation.errors.exchangeRate} help="For GST reporting">
            <NumberInput field="exchangeRate" decimals={4} value={inv.exchangeRate ?? 0} onChange={(n) => ed.update((d) => void (d.exchangeRate = n), "exchangeRate")} />
          </Field>
        ) : (
          <Field label="Invoice title" help={!inv.from.gstin ? "No GSTIN: use Bill of Supply" : undefined}>
            <SelectField field="title" value={inv.title} options={INVOICE_TITLES.map((t) => ({ value: t, label: t }))} onChange={(v) => ed.update((d) => void (d.title = v as typeof d.title))} />
          </Field>
        )}
        {inv.currency !== "INR" && (
          <Field label="Invoice title" className="col-span-2">
            <SelectField field="title" value={inv.title} options={INVOICE_TITLES.map((t) => ({ value: t, label: t }))} onChange={(v) => ed.update((d) => void (d.title = v as typeof d.title))} />
          </Field>
        )}
      </div>

      <div className="rounded-lg border">
        <ToggleRow label="Reverse charge" hint='Prints "Tax payable on reverse charge: Yes"' checked={inv.reverseCharge} onChange={(v) => ed.update((d) => void (d.reverseCharge = v))} />
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change the number of a sent invoice?</AlertDialogTitle>
            <AlertDialogDescription>Your client already has this invoice as {inv.number}. Changing it can cause confusion in their books and your GST returns.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it locked</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUnlocked(true)
                setConfirm(false)
              }}
            >
              Unlock number
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}
