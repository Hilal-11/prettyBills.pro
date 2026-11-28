"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangleIcon, BanIcon, DownloadIcon, LinkIcon, LoaderCircleIcon, Trash2Icon, Undo2Icon, WalletIcon } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { applyCreditAction, deleteRefundAction, recordRefundAction, voidCreditNoteAction } from "@/app/(app)/credit-notes/actions"
import { openInvoicesAction } from "@/app/(app)/payments/actions"
import { DateField, Field, SelectField } from "@/components/invoice-editor/fields"
import { useToast } from "@/components/invoice-editor/toast"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { reasonLabel } from "@/lib/billing/credit-notes"
import { formatDate, todayIST } from "@/lib/billing/dates"
import { MODE_LABEL, PAYMENT_MODES, type PaymentMode } from "@/lib/billing/modes"
import { formatINR, paiseToInput, toPaise } from "@/lib/billing/money"
import { invoicesChanged } from "@/lib/client/workspace"
import type { CreditNoteDetail } from "@/lib/server/db/credit-notes"

export function CreditNoteStatus({ note, className }: { note: Pick<CreditNoteDetail, "status" | "unapplied" | "refunded" | "total">; className?: string }) {
  const [label, dot] =
    note.status === "void"
      ? ["Void", "bg-zinc-400"]
      : note.status === "draft"
        ? ["Draft", "bg-muted-foreground/60"]
        : note.unapplied > 0
          ? [`${formatINR(note.unapplied, { decimals: false })} unapplied`, "bg-amber-500"]
          : note.refunded > 0
            ? ["Refunded", "bg-emerald-500"]
            : ["Issued", "bg-sky-500"]
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground/85", note.status === "void" && "text-muted-foreground line-through", className)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  )
}

type Dlg = null | "apply" | "refund" | "void" | { deleteRefund: string }

/**
 * Beside an issued credit note: where its value went (applied, refunded,
 * left over) and everything that can still be done with it.
 */
export function CreditNotePanel({ note, publicUrl }: { note: CreditNoteDetail; publicUrl: string | null }) {
  const router = useRouter()
  const toast = useToast()
  const [dlg, setDlg] = React.useState<Dlg>(null)
  const issued = note.status === "issued"
  const whatsapp = publicUrl
    ? `https://wa.me/${(note.billTo.phone ?? "").replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(`Hi ${note.clientName || "there"}, credit note ${note.number} for ${formatINR(note.total)} against invoice ${note.invoiceNumber}: ${publicUrl}`)}`
    : null

  const done = (title: string) => {
    setDlg(null)
    invoicesChanged()
    toast({ title, tone: "success", duration: 3000 })
    router.refresh()
  }

  return (
    <div className="grid content-start">
      <section className="grid gap-3 border-b p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-[-0.02em] tabular-nums">{note.number ?? "Draft"}</h1>
          <CreditNoteStatus note={note} />
        </div>
        <p className="text-[13px] text-muted-foreground">
          {reasonLabel(note.reason)} · against{" "}
          <Link href={`/invoices/${note.invoiceId}`} className="font-medium text-foreground hover:underline">
            {note.invoiceNumber}
          </Link>
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] tabular-nums">
          <Fig k="Total credit" v={formatINR(note.total)} strong />
          <Fig k="Applied to invoices" v={formatINR(note.applied)} />
          <Fig k="Refunded" v={formatINR(note.refunded)} />
          <Fig k="Left to use" v={formatINR(Math.max(0, note.unapplied))} tone={note.unapplied > 0 && issued ? "amber" : undefined} />
        </dl>
        {note.lateForGst && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" /> GST credit for this note may not be claimable (time limit under GST law). Check with your CA.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <a href={`/api/credit-notes/${note.id}/pdf`} download className={cn(buttonVariants({ variant: "outline" }), act)}>
            <DownloadIcon /> PDF
          </a>
          {publicUrl && issued && (
            <>
              <Button
                variant="outline"
                className={act}
                onClick={async () => {
                  await navigator.clipboard.writeText(publicUrl).catch(() => {})
                  toast({ title: "Link copied", description: publicUrl, tone: "success", duration: 2500 })
                }}
              >
                <LinkIcon /> Copy link
              </Button>
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline" }), act)}>
                  <FaWhatsapp className="text-emerald-600 dark:text-emerald-400" /> WhatsApp
                </a>
              )}
            </>
          )}
        </div>
        {issued && (
          <div className="flex flex-wrap gap-1.5">
            {note.unapplied > 0 && note.clientId && (
              <Button className={act} onClick={() => setDlg("apply")}>
                <WalletIcon /> Apply to an invoice
              </Button>
            )}
            {note.unapplied > 0 && (
              <Button variant="outline" className={act} onClick={() => setDlg("refund")}>
                <Undo2Icon /> Record refund
              </Button>
            )}
            <Button variant="outline" className={cn(act, "text-red-600 hover:text-red-600 dark:text-red-400")} onClick={() => setDlg("void")}>
              <BanIcon /> Void
            </Button>
          </div>
        )}
        {note.status === "void" && note.voidReason && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Voided: {note.voidReason}</p>}
      </section>

      <section className="border-b p-5">
        <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Applied to</h2>
        {note.allocations.length ? (
          <ul className="grid gap-1.5 text-[13px]">
            {note.allocations.map((a) => (
              <li key={a.id} className={cn("flex items-center justify-between gap-3", a.reversedAt && "text-muted-foreground line-through")}>
                <Link href={`/invoices/${a.invoiceId}`} className="font-medium hover:underline">
                  {a.invoiceNumber}
                </Link>
                <span className="text-xs text-muted-foreground">{formatDate(a.appliedOn)}</span>
                <span className="font-medium tabular-nums">{formatINR(a.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Not applied to any invoice{note.status === "issued" ? " (the invoice was already settled)" : ""}.</p>
        )}
      </section>

      <section className="p-5">
        <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Refunds</h2>
        {note.refunds.length ? (
          <ul className="grid gap-1.5 text-[13px]">
            {note.refunds.map((r) => (
              <li key={r.id} className={cn("flex items-center gap-3", r.deletedAt && "text-muted-foreground line-through")}>
                <span className="grid min-w-0 flex-1">
                  <span className="font-medium tabular-nums">{formatINR(r.amount)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatDate(r.refundedOn)} · {MODE_LABEL[r.mode]}
                    {r.reference ? ` · ${r.reference}` : ""}
                  </span>
                </span>
                {!r.deletedAt && issued && (
                  <Button variant="ghost" size="icon-sm" aria-label="Delete refund" onClick={() => setDlg({ deleteRefund: r.id })}>
                    <Trash2Icon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">No refunds.</p>
        )}
      </section>

      <ApplyDialog open={dlg === "apply"} note={note} onClose={() => setDlg(null)} onDone={done} />
      <RefundDialog open={dlg === "refund"} note={note} onClose={() => setDlg(null)} onDone={done} />
      <ReasonDialog
        open={dlg === "void" || (typeof dlg === "object" && dlg !== null)}
        title={dlg === "void" ? `Void ${note.number}?` : "Delete this refund?"}
        body={dlg === "void" ? "Everything it applied is reversed: invoices go back to what they owed before (they may be overdue again). Its number stays used." : "The credit it used becomes available again."}
        cta={dlg === "void" ? "Void credit note" : "Delete refund"}
        onClose={() => setDlg(null)}
        onConfirm={async (reason) => {
          const r = dlg === "void" ? await voidCreditNoteAction(note.id, reason) : typeof dlg === "object" && dlg ? await deleteRefundAction(dlg.deleteRefund, reason) : null
          if (!r) return null
          if (!r.ok) return r.error
          done(dlg === "void" ? `${note.number} voided` : "Refund deleted")
          return null
        }}
      />
    </div>
  )
}

const act = "h-7 gap-1.5 px-2.5 text-xs"

function Fig({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: "amber" }) {
  return (
    <div className="grid">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={cn(strong ? "text-base font-semibold" : "font-medium", tone === "amber" && "text-amber-700 dark:text-amber-400")}>{v}</dd>
    </div>
  )
}

function ApplyDialog({ open, note, onClose, onDone }: { open: boolean; note: CreditNoteDetail; onClose: () => void; onDone: (t: string) => void }) {
  const [invoices, setInvoices] = React.useState<{ id: string; number: string; balanceDue: number }[] | null>(null)
  const [pick, setPick] = React.useState<string | null>(null)
  const [amount, setAmount] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [key] = React.useState(() => crypto.randomUUID())
  React.useEffect(() => {
    if (!open || !note.clientId) return
    let live = true
    openInvoicesAction(note.clientId).then((r) => live && setInvoices(r.ok ? r.invoices.filter((i) => i.id !== note.invoiceId || i.balanceDue > 0) : []))
    return () => {
      live = false
    }
  }, [open, note.clientId, note.invoiceId])
  const chosen = invoices?.find((i) => i.id === pick)
  const max = chosen ? Math.min(chosen.balanceDue, note.unapplied) : note.unapplied
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Apply credit to an invoice</DialogTitle>
          <DialogDescription>
            {formatINR(note.unapplied)} of {note.number} is available for {note.clientName || "this client"}.
          </DialogDescription>
        </DialogHeader>
        {invoices === null ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <LoaderCircleIcon className="size-3.5 animate-spin" /> Loading their open invoices…
          </p>
        ) : invoices.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">This client has no open invoices. Keep the credit for their next invoice, or record a refund.</p>
        ) : (
          <ul className="grid max-h-56 gap-1 overflow-y-auto">
            {invoices.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPick(i.id)
                    setAmount(paiseToInput(Math.min(i.balanceDue, note.unapplied)))
                  }}
                  className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[13px] transition-colors", pick === i.id ? "border-brand/50 bg-brand/5" : "hover:bg-muted/40")}
                >
                  <span className="font-medium tabular-nums">{i.number}</span>
                  <span className="tabular-nums">{formatINR(i.balanceDue)} due</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {chosen && (
          <Field label="Amount to apply" htmlFor="apply-amt" help={`Up to ${formatINR(max)}`}>
            <Input id="apply-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} className="h-9 text-right text-sm tabular-nums md:text-sm" />
          </Field>
        )}
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" className="h-8 text-[13px]" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="h-8 text-[13px]"
            disabled={!chosen || busy}
            onClick={async () => {
              const p = toPaise(amount)
              if (!p || p <= 0 || p > max) return setError(`Enter between ₹0.01 and ${formatINR(max)}.`)
              setBusy(true)
              const r = await applyCreditAction(note.id, chosen!.id, p, key).catch(() => ({ ok: false as const, error: "You seem to be offline." }))
              setBusy(false)
              if (!r.ok) return setError(r.error)
              onDone(`${formatINR(p)} applied to ${chosen!.number}`)
            }}
          >
            {busy && <LoaderCircleIcon className="animate-spin" />} Apply credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RefundDialog({ open, note, onClose, onDone }: { open: boolean; note: CreditNoteDetail; onClose: () => void; onDone: (t: string) => void }) {
  const today = React.useMemo(() => todayIST(), [])
  const [amount, setAmount] = React.useState(paiseToInput(note.unapplied))
  const [date, setDate] = React.useState(today)
  const [mode, setMode] = React.useState<PaymentMode>("bank_transfer")
  const [reference, setReference] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [key] = React.useState(() => crypto.randomUUID())
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Record a refund</DialogTitle>
          <DialogDescription>Money you paid back to {note.clientName || "the client"} from {note.number}. Up to {formatINR(note.unapplied)}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount" required htmlFor="ref-amt">
            <Input id="ref-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} className="h-9 text-right text-sm tabular-nums md:text-sm" />
          </Field>
          <Field label="Date" required htmlFor="ref-date">
            <DateField id="ref-date" field="ref-date" value={date} max={today} onChange={setDate} />
          </Field>
          <Field label="Mode" htmlFor="ref-mode">
            <SelectField field="ref-mode" value={mode} options={PAYMENT_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))} onChange={(v) => setMode(v as PaymentMode)} />
          </Field>
          <Field label="Reference" htmlFor="ref-ref">
            <Input id="ref-ref" maxLength={64} value={reference} onChange={(e) => setReference(e.target.value)} className="h-9 text-sm md:text-sm" />
          </Field>
        </div>
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" className="h-8 text-[13px]" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="h-8 text-[13px]"
            disabled={busy}
            onClick={async () => {
              const p = toPaise(amount)
              if (!p || p <= 0 || p > note.unapplied) return setError(`Enter between ₹0.01 and ${formatINR(note.unapplied)}.`)
              setBusy(true)
              const r = await recordRefundAction(note.id, { amount: p, refundedOn: date, mode, reference, key }).catch(() => ({ ok: false as const, error: "You seem to be offline." }))
              setBusy(false)
              if (!r.ok) return setError(r.error)
              onDone(`Refund of ${formatINR(p)} recorded`)
            }}
          >
            {busy && <LoaderCircleIcon className="animate-spin" />} Record refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReasonDialog({ open, title, body, cta, onClose, onConfirm }: { open: boolean; title: string; body: string; cta: string; onClose: () => void; onConfirm: (reason: string) => Promise<string | null> }) {
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <Field label="Reason" required htmlFor="cn-reason-why" help="3 to 200 characters, kept in the activity log.">
          <Input id="cn-reason-why" autoFocus maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 text-sm md:text-sm" />
        </Field>
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" className="h-8 text-[13px]" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="h-8 text-[13px]"
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true)
              const e = await onConfirm(reason.trim()).catch(() => "You seem to be offline.")
              setBusy(false)
              setError(e)
              if (!e) setReason("")
            }}
          >
            {busy && <LoaderCircleIcon className="animate-spin" />} {cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
