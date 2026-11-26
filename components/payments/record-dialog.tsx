"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangleIcon, CircleCheckIcon, LoaderIcon, SearchIcon, SendIcon } from "lucide-react"
import { cn } from "cn"

import { markSentAction, openInvoicesAction, paymentContextAction, recordPaymentAction, updatePaymentAction, type PaymentActionResult, type PaymentContext } from "@/app/(app)/payments/actions"
import { ProBadge } from "@/components/app/premium"
import { DateField, Field } from "@/components/invoice-editor/fields"
import { useToast } from "@/components/invoice-editor/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, todayIST } from "@/lib/billing/dates"
import { isMode, MODE_LABEL, PAYMENT_MODES, referenceHint, referenceLabel, upperReference, type PaymentMode } from "@/lib/billing/modes"
import { formatINR, paiseToInput, percentOf, toPaise } from "@/lib/billing/money"
import { invoicesChanged } from "@/lib/client/workspace"
import type { PaymentResult, PlanSummary } from "@/lib/data/types"
import { emailInPlan, upgradeHref } from "@/lib/pricing"

import { ModeIcon } from "./mode-icon"

/** The payment being edited, if any. */
export type EditingPayment = {
  id: string
  amount: number
  paidOn: string
  mode: PaymentMode
  reference: string | null
  note: string | null
  receiptNumber: string | null
  receiptRevision: number
  receiptEmailedAt: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which invoice. Without one, the dialog starts with a picker (optionally limited to one client). */
  invoiceId?: string
  clientId?: string
  editing?: EditingPayment
  onSaved?: (result: PaymentResult) => void
}

type OpenInvoice = { id: string; number: string; clientName: string; balanceDue: number; dueDate: string | null; bucket: string }

type Ctx = { invoice: PaymentContext; lastMode: PaymentMode | null; plan: PlanSummary }

/**
 * Record a payment (or edit one). Amount defaults to the full balance, the
 * date to today in India, the mode to the one used last. Everything that
 * matters is checked again on the server, in one transaction; the dialog
 * only helps get it right first time.
 */
export function RecordPaymentDialog({ open, onOpenChange, invoiceId, clientId, editing, onSaved }: Props) {
  const [picked, setPicked] = React.useState<string | null>(null)
  const [lastOpen, setLastOpen] = React.useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setPicked(null)
  }
  const id = invoiceId ?? picked

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[480px]">
        {id ? (
          <PaymentForm key={`${id}-${editing?.id ?? "new"}`} invoiceId={id} editing={editing} onClose={() => onOpenChange(false)} onSaved={onSaved} onBack={invoiceId ? undefined : () => setPicked(null)} />
        ) : (
          <InvoicePicker clientId={clientId} onPick={setPicked} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- picker -------------------------------- */

function InvoicePicker({ clientId, onPick }: { clientId?: string; onPick: (id: string) => void }) {
  const [state, setState] = React.useState<{ loading: boolean; error?: string; invoices: OpenInvoice[] }>({ loading: true, invoices: [] })
  const [q, setQ] = React.useState("")
  React.useEffect(() => {
    let live = true
    openInvoicesAction(clientId)
      .then((r) => live && setState(r.ok ? { loading: false, invoices: r.invoices } : { loading: false, invoices: [], error: r.error }))
      .catch(() => live && setState({ loading: false, invoices: [], error: "You seem to be offline. Try again." }))
    return () => {
      live = false
    }
  }, [clientId])
  const term = q.trim().toLowerCase()
  const shown = state.invoices.filter((i) => !term || i.number.toLowerCase().includes(term) || i.clientName.toLowerCase().includes(term))

  return (
    <>
      <DialogHeader className="border-b px-5 pt-5 pb-4">
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>Which invoice was paid?</DialogDescription>
      </DialogHeader>
      <div className="px-5 pt-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number or client" aria-label="Search invoices" className="h-9 pl-8 text-sm md:text-sm" />
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto px-3 py-3">
        {state.loading ? (
          <div className="grid gap-2 px-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        ) : state.error ? (
          <p className="px-2 py-6 text-center text-[13px] text-destructive">{state.error}</p>
        ) : shown.length ? (
          <ul className="grid gap-0.5">
            {shown.map((inv) => (
              <li key={inv.id}>
                <button type="button" onClick={() => onPick(inv.id)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50">
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium tabular-nums">{inv.number}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {inv.clientName || "No client"}
                      {inv.dueDate && <> · {inv.bucket === "overdue" ? <span className="text-red-600 dark:text-red-400">overdue</span> : `due ${formatDate(inv.dueDate)}`}</>}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatINR(inv.balanceDue)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">{term ? "No open invoice matches that." : "No sent invoices are waiting for payment."}</p>
        )}
      </div>
    </>
  )
}

/* -------------------------------- form --------------------------------- */

function PaymentForm({ invoiceId, editing, onClose, onSaved, onBack }: { invoiceId: string; editing?: EditingPayment; onClose: () => void; onSaved?: (r: PaymentResult) => void; onBack?: () => void }) {
  const toast = useToast()
  const router = useRouter()
  const [ctx, setCtx] = React.useState<Ctx | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [key] = React.useState(() => crypto.randomUUID()) // one per dialog: a retry can't pay twice
  const today = React.useMemo(() => todayIST(), [])

  const [amountText, setAmountText] = React.useState(editing ? paiseToInput(editing.amount) : "")
  const [paidOn, setPaidOn] = React.useState(editing?.paidOn ?? today)
  const [mode, setMode] = React.useState<PaymentMode>(editing?.mode ?? "upi")
  const [reference, setReference] = React.useState(editing?.reference ?? "")
  const [note, setNote] = React.useState(editing?.note ?? "")
  const [emailReceipt, setEmailReceipt] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<{ message: string; code?: string } | null>(null)
  const [touched, setTouched] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoadError(null)
    const r = await paymentContextAction(invoiceId).catch(() => null)
    if (!r) return setLoadError("You seem to be offline. Try again.")
    if (!r.ok) return setLoadError(r.error)
    const next: Ctx = { invoice: r.invoice, lastMode: isMode(r.lastMode) ? r.lastMode : null, plan: r.plan }
    setCtx(next)
    if (!editing) {
      setAmountText(paiseToInput(r.invoice.balanceDue))
      if (next.lastMode) setMode(next.lastMode)
      setEmailReceipt(emailInPlan(r.plan) && !!r.invoice.clientEmail)
    }
  }, [invoiceId, editing])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on open
    void load()
  }, [load])

  if (loadError) {
    return (
      <div className="grid gap-4 p-6 text-center">
        <DialogTitle className="text-base">Couldn&apos;t open this invoice</DialogTitle>
        <p className="text-[13px] text-muted-foreground">{loadError}</p>
        <Button variant="outline" className="mx-auto h-8 text-[13px]" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }
  if (!ctx) return <FormSkeleton />

  const inv = ctx.invoice
  // editing: this payment's amount is available again
  const maxAmount = inv.balanceDue + (editing?.amount ?? 0)
  const paidOthers = inv.amountPaid - (editing?.amount ?? 0)
  const amount = toPaise(amountText)
  const amountError = !touched && !amountText ? null : amount === null ? "Enter an amount like 14575 or 14,575.50" : amount <= 0 ? "Enter an amount greater than ₹0." : amount > maxAmount ? `More than the balance due (${formatINR(maxAmount)}). Enter ${formatINR(maxAmount)} or less.` : null
  const after = amount && amount > 0 && amount <= maxAmount ? inv.total - paidOthers - amount : null
  const dateError = paidOn > today ? "Payment date can't be in the future." : null
  const early = paidOn < inv.issueDate
  const refLabel = referenceLabel(mode)
  const hint = refLabel ? referenceHint(mode, reference) : null
  const canEmail = emailInPlan(ctx.plan)
  const left = ctx.plan.emails.limit - ctx.plan.emails.used
  const draft = inv.status === "draft"
  const isVoid = inv.status === "void"
  const wasEmailed = !!editing?.receiptEmailedAt

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    setTouched(true)
    if (busy || amount === null || amount <= 0 || amount > maxAmount || dateError) return
    setBusy(true)
    setError(null)
    const body = { amountPaise: amount, paidOn, mode, reference: refLabel ? reference : undefined, note }
    let r: PaymentActionResult
    try {
      r = editing
        ? await updatePaymentAction({ paymentId: editing.id, ...body }, { emailReceipt: emailReceipt && canEmail })
        : await recordPaymentAction({ invoiceId, idempotencyKey: key, ...body }, { emailReceipt: emailReceipt && canEmail })
    } catch {
      r = { ok: false, error: "You seem to be offline. Your payment was not saved. Try again." }
    }
    setBusy(false)
    if (!r.ok) return setError({ message: r.error, code: (r as { code?: string }).code })

    const { result, email } = r
    const emailFailed = email && email.status !== "sent" ? email : null
    invoicesChanged()
    onSaved?.(result)
    onClose()
    toast({
      title: editing ? `Payment updated · Receipt ${result.receipt.number} revised` : `Payment of ${formatINR(result.payment.amount)} recorded · Receipt ${result.receipt.number}`,
      description:
        email?.status === "sent"
          ? `Receipt emailed to ${email.to}${email.outbox ? " (saved to the dev outbox)" : ""}`
          : emailFailed
            ? `Payment saved, but the receipt email didn't go out: ${emailFailed.message}`
            : result.invoice.balanceDue === 0
              ? `${result.invoice.number} is paid in full.`
              : `${formatINR(result.invoice.balanceDue)} still due on ${result.invoice.number}.`,
      tone: emailFailed ? "error" : "success",
      duration: 6000,
      action: { label: "View receipt", onClick: () => router.push(`/receipts/${result.receipt.id}`) },
    })
  }

  async function markSentAndRetry() {
    setBusy(true)
    const r = await markSentAction(invoiceId).catch(() => ({ ok: false as const, error: "You seem to be offline. Try again." }))
    setBusy(false)
    if (!r.ok) return setError({ message: r.error })
    invoicesChanged()
    setError(null)
    setCtx({ ...ctx!, invoice: { ...inv, status: "sent" } })
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader className="border-b px-5 pt-5 pb-4">
        <DialogTitle>{editing ? "Edit payment" : "Record payment"}</DialogTitle>
        <DialogDescription className="tabular-nums">
          {inv.number}
          {inv.clientName ? ` · ${inv.clientName}` : ""}
          {onBack && (
            <button type="button" onClick={onBack} className="ml-2 font-medium text-brand hover:underline dark:text-[#6da2ff]">
              Change
            </button>
          )}
        </DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-3 divide-x border-b bg-muted/30 text-center text-[12px] tabular-nums">
        <Stat k="Total" v={formatINR(inv.total)} />
        <Stat k="Paid" v={formatINR(paidOthers)} />
        <Stat k="Balance" v={formatINR(inv.total - paidOthers)} strong />
      </dl>

      <div className="grid max-h-[min(60dvh,560px)] gap-4 overflow-y-auto px-5 py-4">
        {(draft || isVoid) && (
          <Notice tone="warn">
            {isVoid ? "This invoice is void. Payments can't be recorded." : "This invoice is still a draft. Mark it as sent to record payments."}
            {draft && (
              <Button type="button" variant="outline" className="mt-2 h-7 gap-1.5 px-2.5 text-xs" disabled={busy} onClick={() => void markSentAndRetry()}>
                <SendIcon /> Mark as sent
              </Button>
            )}
          </Notice>
        )}

        <Field label="Amount" required htmlFor="pay-amount" error={amountError ?? undefined}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2.5 grid place-items-center text-sm text-foreground/60">₹</span>
            <Input
              id="pay-amount"
              autoFocus
              inputMode="decimal"
              autoComplete="off"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ""))}
              onBlur={() => {
                setTouched(true)
                const p = toPaise(amountText)
                if (p !== null) setAmountText(paiseToInput(p))
              }}
              aria-invalid={!!amountError || undefined}
              aria-describedby={amountError ? "pay-amount-error" : "pay-amount-after"}
              className="h-10 bg-background pl-7 text-right text-base font-semibold tabular-nums md:text-base"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip onClick={() => setAmountText(paiseToInput(maxAmount))} active={amount === maxAmount}>
              Full balance
            </Chip>
            {maxAmount >= 2 && (
              <Chip onClick={() => setAmountText(paiseToInput(percentOf(maxAmount, 50)))} active={amount === percentOf(maxAmount, 50)}>
                50%
              </Chip>
            )}
            <span id="pay-amount-after" aria-live="polite" className="ml-auto text-xs tabular-nums">
              {after === null ? null : after === 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <CircleCheckIcon className="size-3.5" /> Paid in full
                </span>
              ) : (
                <span className="text-foreground/70">
                  After this payment: <span className="font-semibold text-foreground">Balance {formatINR(after)}</span> · Partially paid
                </span>
              )}
            </span>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment date" required htmlFor="pay-date" error={dateError ?? undefined} help={early && !dateError ? "This is before the invoice date. Recording an advance?" : undefined}>
            <DateField id="pay-date" field="pay-date" value={paidOn} max={today} onChange={setPaidOn} error={dateError ?? undefined} />
          </Field>
          {refLabel ? (
            <Field label={refLabel} htmlFor="pay-ref" help={hint ?? "Optional"}>
              <Input
                id="pay-ref"
                autoComplete="off"
                maxLength={64}
                value={reference}
                onChange={(e) => setReference(upperReference(mode) ? e.target.value.toUpperCase() : e.target.value)}
                className="h-9 bg-background text-sm tabular-nums md:text-sm"
              />
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium text-foreground/90">
            Mode<span className="ml-0.5 text-destructive" aria-hidden>*</span>
          </legend>
          <div role="radiogroup" aria-label="Payment mode" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {PAYMENT_MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  mode === m ? "border-brand bg-brand/8 text-foreground dark:border-[#6da2ff]" : "bg-background text-foreground/70 hover:bg-muted"
                )}
              >
                <ModeIcon mode={m} className="size-4" />
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Note" htmlFor="pay-note" aside={<span className="text-[11px] text-muted-foreground tabular-nums">{note.length}/500</span>} help="Only you see this.">
          <Textarea id="pay-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-14 resize-y text-sm md:text-sm" />
        </Field>

        {editing && wasEmailed && (
          <Notice tone="warn">
            Receipt {editing.receiptNumber} was already sent to the client. Saving will update it to revision {editing.receiptRevision + 1}.
          </Notice>
        )}

        <div className="rounded-lg border px-3 py-2.5">
          <label className={cn("flex items-start gap-2.5 text-[13px]", !canEmail && "opacity-80")}>
            <Checkbox
              checked={emailReceipt && canEmail}
              disabled={!canEmail || !inv.clientEmail}
              onCheckedChange={(v) => setEmailReceipt(!!v)}
              className="mt-0.5 data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand"
            />
            <span className="grid gap-0.5">
              <span className="flex items-center gap-2 font-medium">
                {editing && wasEmailed ? "Send the updated receipt" : "Email the receipt to the client"} {!canEmail && <ProBadge />}
              </span>
              <span className="text-xs text-muted-foreground">
                {!canEmail ? (
                  <>
                    Pro emails receipts for you.{" "}
                    <Link href={upgradeHref("email")} className="font-medium text-brand hover:underline dark:text-[#6da2ff]">
                      See plans
                    </Link>{" "}
                    · You can share it on WhatsApp for free after saving.
                  </>
                ) : !inv.clientEmail ? (
                  "This client has no email address. Share the receipt on WhatsApp after saving."
                ) : (
                  <>
                    To {inv.clientEmail} · {left.toLocaleString("en-IN")} of {ctx.plan.emails.limit.toLocaleString("en-IN")} emails left this month
                  </>
                )}
              </span>
            </span>
          </label>
        </div>

        {error && (
          <Notice tone="error">
            {error.message}
            {error.code === "INVOICE_NOT_SENT" && (
              <Button type="button" variant="outline" className="mt-2 h-7 gap-1.5 px-2.5 text-xs" disabled={busy} onClick={() => void markSentAndRetry()}>
                <SendIcon /> Mark as sent
              </Button>
            )}
          </Notice>
        )}
      </div>

      <DialogFooter className="border-t px-5 py-3">
        <Button type="button" variant="outline" className="h-8 text-[13px]" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="h-8 min-w-36 text-[13px]" disabled={busy || draft || isVoid}>
          {busy && <LoaderIcon className="animate-spin" />}
          {editing ? "Save changes" : "Record payment"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Stat({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="px-2 py-2.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("mt-0.5 text-[13px]", strong ? "font-semibold" : "font-medium text-foreground/85")}>{v}</dd>
    </div>
  )
}

function Chip({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("h-6 rounded-md border px-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50", active ? "border-brand/50 bg-brand/8 text-foreground" : "bg-background text-foreground/70 hover:bg-muted")}>
      {children}
    </button>
  )
}

export function Notice({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : undefined} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px]", tone === "error" ? "border-destructive/30 bg-destructive/8 text-destructive" : "border-amber-400/40 bg-amber-400/10 text-amber-900 dark:text-amber-200")}>
      <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading invoice" className="grid gap-4 p-5">
      <DialogTitle className="sr-only">Record payment</DialogTitle>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-12 rounded-lg" />
      <Skeleton className="h-10 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
      </div>
      <Skeleton className="h-14 rounded-lg" />
    </div>
  )
}
