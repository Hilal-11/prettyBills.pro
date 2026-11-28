"use client"

import * as React from "react"
import Link from "next/link"
import { WalletCardsIcon } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import type { PaymentDefaults } from "@/lib/data/types"
import { IFSC_BANKS } from "@/lib/invoice/config"
import { formatMoney } from "@/lib/invoice/totals"
import type { BankDetails } from "@/lib/invoice/types"
import { RX } from "@/lib/invoice/validate"

import { Field, Segmented, TextField, ToggleRow } from "../fields"
import { GuestSaveHint } from "../account-dialog"
import { SectionCard } from "../section-card"
import type { EditorApi } from "../use-editor"

// PLACEHOLDER: flip once a payment gateway can be connected in Settings.
const GATEWAY_CONNECTED = false

export function PaymentSection({ ed }: { ed: EditorApi }) {
  const p = ed.invoice.payment
  const [saveDefault, setSaveDefault] = React.useState(false)
  const err = (k: string) => ed.errorFor(k) ?? (k === "payment.bank.confirm" ? ed.validation.errors[k] : undefined)
  const bank: BankDetails = p.bank ?? { holder: ed.invoice.from.name, accountNumber: "", ifsc: "", accountType: "current" }

  const { saveDefaults } = ed
  React.useEffect(() => {
    if (!saveDefault) return
    // what was paid belongs to this invoice, not the default
    saveDefaults({ payment: Object.fromEntries(Object.entries(p).filter(([k]) => k !== "amountPaid")) as PaymentDefaults })
  }, [saveDefault, p, saveDefaults])

  const setBank = (patch: Partial<BankDetails>, key: string) => ed.update((d) => void (d.payment.bank = { ...bank, ...d.payment.bank, ...patch }), key)

  return (
    <SectionCard
      ed={ed}
      id="payment"
      icon={WalletCardsIcon}
      title={ed.isQuote ? "Payment details" : "Payment"}
      summary={[p.showUpiQr && "UPI QR", p.showBank && "Bank transfer", !ed.isQuote && p.amountPaid > 0 && `${formatMoney(p.amountPaid)} paid`].filter(Boolean).join(" · ") || "No payment details"}
    >
      <div className="divide-y rounded-lg border">
        <ToggleRow label="Show UPI QR" hint="Clients scan to pay the balance due" checked={p.showUpiQr} onChange={(v) => ed.update((d) => void (d.payment.showUpiQr = v))} />
        {p.showUpiQr && (
          <div className="px-3 py-2.5">
            <Field label="UPI ID" required error={err("payment.upiId")} htmlFor="f-payment-upiId">
              <TextField field="payment.upiId" placeholder="name@bank" value={p.upiId} error={err("payment.upiId")} onBlur={() => ed.touch("payment.upiId")} onChange={(v) => ed.update((d) => void (d.payment.upiId = v.trim()), "payment.upiId")} />
            </Field>
          </div>
        )}
        <ToggleRow label="Show bank details" hint="Account, IFSC and bank name" checked={p.showBank} onChange={(v) => ed.update((d) => void ((d.payment.showBank = v), v && !d.payment.bank && (d.payment.bank = bank)))} />
        {p.showBank && (
          <div className="grid grid-cols-2 gap-3 px-3 py-3">
            <Field label="Account holder" required error={err("payment.bank.holder")} className="col-span-2">
              <TextField field="payment.bank.holder" value={bank.holder} error={err("payment.bank.holder")} onBlur={() => ed.touch("payment.bank.holder")} onChange={(v) => setBank({ holder: v }, "bank.holder")} />
            </Field>
            <Field label="Account number" required error={err("payment.bank.accountNumber")}>
              <TextField
                field="payment.bank.accountNumber"
                inputMode="numeric"
                autoComplete="off"
                value={bank.accountNumber}
                error={err("payment.bank.accountNumber")}
                onBlur={() => ed.touch("payment.bank.accountNumber")}
                onChange={(v) => setBank({ accountNumber: v.replace(/\D/g, "") }, "bank.account")}
              />
            </Field>
            <Field label="Confirm account number" error={ed.confirmAccount !== undefined ? ed.validation.errors["payment.bank.confirm"] : undefined}>
              <TextField
                field="payment.bank.confirm"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={ed.confirmAccount ?? ""}
                onChange={(v) => ed.setConfirmAccount(v.replace(/\D/g, ""))}
              />
            </Field>
            <Field label="IFSC" required error={err("payment.bank.ifsc")} help={bank.ifsc && RX.ifsc.test(bank.ifsc) ? (IFSC_BANKS[bank.ifsc.slice(0, 4)] ?? "Bank not recognised; type its name") : "11 characters, like HDFC0001234"}>
              <TextField
                field="payment.bank.ifsc"
                upper
                maxLength={11}
                value={bank.ifsc}
                error={err("payment.bank.ifsc")}
                onBlur={() => ed.touch("payment.bank.ifsc")}
                onChange={(v) => {
                  const ifsc = v.toUpperCase()
                  const name = RX.ifsc.test(ifsc) ? IFSC_BANKS[ifsc.slice(0, 4)] : undefined
                  setBank({ ifsc, ...(name ? { bankName: name } : {}) }, "bank.ifsc")
                }}
              />
            </Field>
            <Field label="Account type">
              <Segmented
                label="Account type"
                layoutId="acct-type"
                value={bank.accountType}
                options={[
                  { value: "current", label: "Current" },
                  { value: "savings", label: "Savings" },
                ]}
                onChange={(v) => setBank({ accountType: v }, "bank.type")}
              />
            </Field>
            <Field label="Bank name">
              <TextField field="payment.bank.bankName" value={bank.bankName} onChange={(v) => setBank({ bankName: v }, "bank.name")} />
            </Field>
            <Field label="Branch">
              <TextField field="payment.bank.branch" value={bank.branch} onChange={(v) => setBank({ branch: v }, "bank.branch")} />
            </Field>
          </div>
        )}
        <ToggleRow
          label="Online payment link"
          hint={
            GATEWAY_CONNECTED ? (
              "Adds Pay now to the shared page and email"
            ) : (
              <>
                Connect a payment gateway in{" "}
                <Link href="/settings/payments" className="underline underline-offset-2">
                  Settings
                </Link>
              </>
            )
          }
          disabled={!GATEWAY_CONNECTED}
          checked={GATEWAY_CONNECTED && p.paymentLink}
          onChange={(v) => ed.update((d) => void (d.payment.paymentLink = v))}
        />
      </div>

      <Field label="Payment instructions">
        <Textarea
          data-field="payment.instructions"
          rows={2}
          value={p.instructions ?? ""}
          placeholder="Please mention the invoice number in the payment note."
          onChange={(e) => ed.update((d) => void (d.payment.instructions = e.target.value), "payment.instructions")}
          className="min-h-16 resize-y text-sm md:text-sm"
        />
      </Field>

      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground/70">
        {ed.isQuote
          ? ed.mode === "proforma"
            ? "Printed so the client can pay an advance. To record it, convert this proforma to an invoice, then record the payment there."
            : "Printed for the client's reference. Payments aren't recorded on quotes: convert it to an invoice first."
          : p.amountPaid > 0
          ? `${formatMoney(p.amountPaid)} received, ${formatMoney(ed.totals.balanceDue)} due. Payments are recorded in the Payments card above, each with its own receipt.`
          : ed.guest
            ? "Once you log in and send this invoice, you can record payments against it, each with a receipt."
            : "Record payments once the invoice is sent. The invoice then shows Amount paid and Balance due by itself."}
      </p>

      {ed.guest ? (
        <div className="border-t border-dashed pt-3">
          <GuestSaveHint ed={ed}>to save these payment details for next time</GuestSaveHint>
        </div>
      ) : (
        <label className="flex items-center gap-2 border-t border-dashed pt-3 text-[13px]">
          <Checkbox checked={saveDefault} onCheckedChange={(v) => setSaveDefault(!!v)} className="data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand" />
          Save as default payment details
        </label>
      )}
    </SectionCard>
  )
}
