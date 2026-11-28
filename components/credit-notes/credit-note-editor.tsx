"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { AlertTriangleIcon, ArrowUpRightIcon, CheckIcon, Columns2Icon, EyeIcon, LoaderCircleIcon, PanelLeftIcon } from "lucide-react"
import { cn } from "cn"

import { saveCreditNoteAction } from "@/app/(app)/credit-notes/actions"
import { DateField, Field, SelectField } from "@/components/invoice-editor/fields"
import { useToast } from "@/components/invoice-editor/toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import { buildCreditNote, CN_REASONS, fullRemaining, isLateForGst, type CnReason, type CreditLineInput, type CreditNoteInput, type CreditableLine, type PriorCredit } from "@/lib/billing/credit-notes"
import { formatDate, todayIST } from "@/lib/billing/dates"
import { MODE_LABEL, PAYMENT_MODES, type PaymentMode } from "@/lib/billing/modes"
import { formatINR, paiseToInput, toPaise } from "@/lib/billing/money"
import { invoicesChanged } from "@/lib/client/workspace"
import type { Invoice } from "@/lib/invoice/types"
import { spring } from "@/lib/motion"

import { CreditNoteDocument, type CreditNoteView } from "./credit-note-document"

type LineState = { on: boolean; kind: "qty" | "amount"; qty: string; amount: string }

export type EditorDraft = { id: string; input: CreditNoteInput }

type Props = {
  invoice: Invoice
  summary: { id: string; number: string; issueDate: string; total: number; paid: number; credited: number; balance: number; clientId: string | null }
  prior: PriorCredit
  lines: CreditableLine[]
  rates: number[]
  draft?: EditorDraft
}

const card = "rounded-xl border bg-background"
const VIEWS = [
  { v: "form", label: "Form", icon: PanelLeftIcon },
  { v: "both", label: "Both", icon: Columns2Icon },
  { v: "preview", label: "Preview", icon: EyeIcon },
] as const

/**
 * The credit note editor, in the invoice editor's frame: top bar with the
 * breadcrumb and status, the form in section cards on the left, the live
 * document on the right, and a sticky footer with the total and actions.
 * Figures come from the same calculator the server uses before it saves.
 */
export function CreditNoteEditor({ invoice, summary, prior, lines, rates, draft }: Props) {
  const router = useRouter()
  const toast = useToast()
  const today = React.useMemo(() => todayIST(), [])
  const [key] = React.useState(() => crypto.randomUUID())
  const [view, setView] = React.useState<"form" | "both" | "preview">("both")
  const init = draft?.input

  const [cnDate, setCnDate] = React.useState(init?.cnDate ?? today)
  const [reason, setReason] = React.useState<CnReason>(init?.reason ?? "sales_return")
  const [reasonText, setReasonText] = React.useState(init?.reasonText ?? "")
  const [notes, setNotes] = React.useState(init?.notes ?? "")
  const [mode, setMode] = React.useState<"items" | "lump_sum">(init?.mode ?? "items")
  const [lineState, setLineState] = React.useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      lines.map((l) => {
        const was = init?.lines?.find((x) => x.lineId === l.id)
        return [l.id, { on: !!was, kind: was?.kind ?? (l.charge ? "amount" : "qty"), qty: String(was?.qty ?? Math.min(1, l.qty)), amount: paiseToInput(was?.amount ?? l.remaining) }]
      })
    )
  )
  const [lump, setLump] = React.useState({ description: init?.lump?.description ?? "", taxable: init?.lump ? paiseToInput(init.lump.taxable) : "", rate: init?.lump?.rate ?? rates.at(-1) ?? 0 })
  const [after, setAfter] = React.useState<"credit" | "refund">("credit")
  const [refund, setRefund] = React.useState<{ date: string; mode: PaymentMode; reference: string }>({ date: today, mode: "bank_transfer", reference: "" })
  const [busy, setBusy] = React.useState<null | "save" | "issue">(null)
  const [confirming, setConfirming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const input: CreditNoteInput = {
    cnDate,
    reason,
    reasonText,
    notes,
    mode,
    lines:
      mode === "items"
        ? lines
            .filter((l) => lineState[l.id]?.on)
            .map((l): CreditLineInput => {
              const s = lineState[l.id]
              return s.kind === "qty" ? { lineId: l.id, kind: "qty", qty: Number(s.qty) } : { lineId: l.id, kind: "amount", amount: toPaise(s.amount) ?? 0 }
            })
        : undefined,
    lump: mode === "lump_sum" ? { description: lump.description, taxable: toPaise(lump.taxable) ?? 0, rate: lump.rate } : undefined,
  }
  const built = buildCreditNote(invoice, summary.total, prior, input)
  const total = built.ok ? built.doc.total_paise : 0
  const applies = Math.min(total, summary.balance)
  const leftOver = total - applies
  const late = isLateForGst(summary.issueDate, cnDate)
  const dateError = cnDate > today ? "Can't be in the future." : cnDate < summary.issueDate ? `Can't be before the invoice (${formatDate(summary.issueDate)}).` : null

  const preview: CreditNoteView = {
    id: "preview",
    number: null,
    date: cnDate,
    status: "draft",
    reason,
    reasonText: reasonText || null,
    mode,
    invoiceId: summary.id,
    invoiceNumber: summary.number,
    invoiceDate: summary.issueDate,
    clientId: summary.clientId,
    clientName: invoice.billTo.name,
    from: invoice.from,
    billTo: invoice.billTo,
    placeOfSupply: invoice.placeOfSupply,
    supplyType: invoice.supplyType,
    taxType: built.ok ? built.doc.tax_type : "none",
    taxable: built.ok ? built.doc.taxable_paise : 0,
    cgst: built.ok ? built.doc.cgst_paise : 0,
    sgst: built.ok ? built.doc.sgst_paise : 0,
    igst: built.ok ? built.doc.igst_paise : 0,
    roundOff: built.ok ? built.doc.round_off_paise : 0,
    total,
    applied: 0,
    refunded: 0,
    unapplied: 0,
    lateForGst: late,
    templateId: invoice.templateId,
    pageColor: invoice.pageColor === "black" ? "black" : "white",
    notes: notes || null,
    publicToken: null,
    linkActive: false,
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
    createdAt: "",
    items: built.ok
      ? built.doc.items.map((i, n) => ({ id: String(n), invoiceItemId: i.invoice_item_id, name: i.name, description: i.description ?? null, hsnSac: i.hsn_sac ?? null, qty: i.qty, unit: i.unit ?? null, rate: i.rate_paise, taxable: i.taxable_paise, taxRate: i.tax_rate_bp / 100, tax: i.tax_paise, total: i.total_paise }))
      : [],
  }

  async function save(issue: boolean) {
    setError(null)
    if (dateError) return setError(`Date: ${dateError}`)
    if (!built.ok) return setError(built.error)
    setBusy(issue ? "issue" : "save")
    const r = await saveCreditNoteAction({
      id: draft?.id ?? null,
      invoiceId: summary.id,
      input,
      key,
      issue,
      refundNow: issue && after === "refund" && leftOver > 0 ? { amount: leftOver, refundedOn: refund.date, mode: refund.mode, reference: refund.reference } : null,
    }).catch(() => ({ ok: false as const, error: "You seem to be offline. Nothing was saved." }))
    setBusy(null)
    setConfirming(false)
    if (!r.ok) return setError(r.error)
    invoicesChanged()
    toast({
      title: issue ? `Credit note ${r.number} issued` : "Draft saved",
      description: issue ? (r.refundError ? `Issued, but the refund wasn't recorded: ${r.refundError}` : r.unapplied > 0 ? `${formatINR(r.unapplied)} left as credit for ${invoice.billTo.name || "the client"}.` : `${summary.number} updated.`) : undefined,
      tone: r.refundError ? "error" : "success",
      duration: 5000,
    })
    router.replace(`/credit-notes/${r.id}`)
    router.refresh()
  }

  const setLine = (id: string, patch: Partial<LineState>) => setLineState((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* top bar, as in the invoice editor */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger className="-ml-1 text-foreground/70" />
        <Separator orientation="vertical" className="mr-1 h-4 data-vertical:self-center" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <Link href="/credit-notes" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            Credit notes
          </Link>
          <span aria-hidden className="hidden text-muted-foreground/60 sm:inline">/</span>
          <span className="truncate font-semibold">{draft ? "CN draft" : "New credit note"}</span>
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/85">
            <span className="size-1.5 rounded-full bg-muted-foreground/60" /> Draft
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <div role="radiogroup" aria-label="View" className="hidden rounded-lg border bg-muted/50 p-0.5 md:inline-flex">
            {VIEWS.map((v) => (
              <button key={v.v} type="button" role="radio" aria-checked={view === v.v} onClick={() => setView(v.v)} className={cn("relative isolate inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors", view === v.v ? "text-foreground" : "text-foreground/60 hover:text-foreground")}>
                {view === v.v && <motion.span layoutId="cn-view" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
                <v.icon className="size-3.5" />
                <span className="hidden lg:inline">{v.label}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" className="h-8 px-3 text-[13px]" disabled={!!busy} onClick={() => void save(false)}>
            {busy === "save" && <LoaderCircleIcon className="animate-spin" />} Save draft
          </Button>
          <Button className="h-8 px-3 text-[13px]" disabled={!!busy || !built.ok || !!dateError} onClick={() => setConfirming(true)}>
            Issue credit note
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* form */}
        <div className={cn("flex min-h-0 w-full flex-col border-r md:max-w-[560px]", view === "preview" && "md:hidden")}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <section className={cn(card, "p-4")}>
              <h2 className="text-[13px] font-semibold">Original invoice</h2>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] tabular-nums sm:grid-cols-3">
                <Pair k="Invoice" v={summary.number} />
                <Pair k="Date" v={formatDate(summary.issueDate)} />
                <Pair k="Total" v={formatINR(summary.total)} />
                <Pair k="Already credited" v={formatINR(prior.total)} />
                <Pair k="Received" v={formatINR(summary.paid)} />
                <Pair k="Balance" v={formatINR(summary.balance)} strong />
              </dl>
              <Link href={`/invoices/${summary.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline dark:text-[#6da2ff]">
                View invoice <ArrowUpRightIcon className="size-3" />
              </Link>
              {late && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" /> GST credit for this note may not be claimable (time limit under GST law). Check with your CA.
                </p>
              )}
            </section>

            <section className={cn(card, "grid gap-3 p-4")}>
              <h2 className="text-[13px] font-semibold">Credit details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Credit note date" required htmlFor="cn-date" error={dateError ?? undefined}>
                  <DateField id="cn-date" field="cn-date" value={cnDate} min={summary.issueDate} max={today} onChange={setCnDate} />
                </Field>
                <Field label="Reason" required htmlFor="cn-reason">
                  <SelectField field="cn-reason" value={reason} options={CN_REASONS.map((r) => ({ value: r.key, label: r.label }))} onChange={(v) => setReason(v as CnReason)} />
                </Field>
              </div>
              <Field label="Reason details" required={reason === "other"} htmlFor="cn-reason-text" help="Printed on the credit note.">
                <Input id="cn-reason-text" maxLength={300} value={reasonText} onChange={(e) => setReasonText(e.target.value)} className="h-9 text-sm md:text-sm" />
              </Field>
              <Field label="Notes to client" htmlFor="cn-notes">
                <Textarea id="cn-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-14 text-sm md:text-sm" />
              </Field>
            </section>

            <section className={cn(card, "grid gap-3 p-4")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[13px] font-semibold">What to credit</h2>
                <div role="radiogroup" aria-label="Credit by" className="inline-flex rounded-lg border bg-muted/50 p-0.5">
                  {(
                    [
                      ["items", "Select invoice items"],
                      ["lump_sum", "Lump-sum adjustment"],
                    ] as const
                  ).map(([m, label]) => (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("h-7 rounded-md px-2.5 text-xs font-medium transition-colors", mode === m ? "border bg-background text-foreground shadow-xs" : "text-foreground/60 hover:text-foreground")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "items" ? (
                <>
                  <div className="flex gap-1.5">
                    <Button type="button" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setLineState((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, on: (lines.find((l) => l.id === k)?.remaining ?? 0) > 0 }])))}>
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => {
                        const full = fullRemaining(invoice, prior)
                        setLineState((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => {
                          const f = full.find((x) => x.lineId === k)
                          return [k, f ? { on: true, kind: f.kind, qty: String(f.qty ?? v.qty), amount: paiseToInput(f.amount ?? 0) || v.amount } : { ...v, on: false }]
                        })))
                      }}
                    >
                      Credit full remaining amount
                    </Button>
                  </div>
                  <ul className="divide-y rounded-lg border">
                    {lines.map((l) => {
                      const s = lineState[l.id]
                      const lineErr = !built.ok && built.lineId === l.id ? built.error : null
                      const out = built.ok ? built.doc.items.find((i) => i.invoice_item_id === l.id) : undefined
                      return (
                        <li key={l.id} className={cn("grid gap-2 px-3 py-2.5 text-[13px]", s.on && "bg-brand/[0.03]", l.remaining === 0 && "opacity-55")}>
                          <label className="flex items-start gap-2.5">
                            <Checkbox checked={s.on} disabled={l.remaining === 0} onCheckedChange={(v) => setLine(l.id, { on: !!v })} className="mt-0.5" />
                            <span className="grid min-w-0 flex-1">
                              <span className="truncate font-medium">{l.name}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {l.charge ? "Charge" : `${l.qty} ${l.unit}`} · {formatINR(l.taxable)} taxable · {l.rate}% tax · {l.remaining === 0 ? "fully credited" : `${formatINR(l.remaining)} left`}
                              </span>
                            </span>
                            {out && <span className="shrink-0 font-semibold tabular-nums">{formatINR(out.total_paise)}</span>}
                          </label>
                          {s.on && (
                            <div className="ml-6.5 flex flex-wrap items-center gap-2">
                              {!l.charge && (
                                <div role="radiogroup" aria-label={`Credit ${l.name} by`} className="inline-flex rounded-md border bg-muted/50 p-0.5">
                                  {(["qty", "amount"] as const).map((k) => (
                                    <button key={k} type="button" role="radio" aria-checked={s.kind === k} onClick={() => setLine(l.id, { kind: k })} className={cn("h-6 rounded px-2 text-[11px] font-medium", s.kind === k ? "border bg-background shadow-xs" : "text-foreground/60")}>
                                      {k === "qty" ? "Quantity" : "Amount"}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {s.kind === "qty" && !l.charge ? (
                                <Input aria-label={`Quantity of ${l.name} to credit`} type="number" min={0} max={l.qty} step="any" value={s.qty} onChange={(e) => setLine(l.id, { qty: e.target.value })} className="h-8 w-24 text-right text-sm tabular-nums md:text-sm" />
                              ) : (
                                <div className="relative">
                                  <span className="pointer-events-none absolute inset-y-0 left-2.5 grid place-items-center text-sm text-foreground/60">₹</span>
                                  <Input aria-label={`Taxable amount of ${l.name} to credit`} inputMode="decimal" value={s.amount} onChange={(e) => setLine(l.id, { amount: e.target.value.replace(/[^\d.,]/g, "") })} className="h-8 w-32 pl-6 text-right text-sm tabular-nums md:text-sm" />
                                </div>
                              )}
                              <span className="text-xs text-muted-foreground">{s.kind === "qty" && !l.charge ? `of ${l.qty}` : "excluding GST"}</span>
                            </div>
                          )}
                          {lineErr && <p className="ml-6.5 text-xs text-destructive">{lineErr}</p>}
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem]">
                  <Field label="Description" required htmlFor="cn-lump-desc">
                    <Input id="cn-lump-desc" maxLength={300} value={lump.description} onChange={(e) => setLump({ ...lump, description: e.target.value })} className="h-9 text-sm md:text-sm" />
                  </Field>
                  <Field label="Taxable amount" required htmlFor="cn-lump-amt">
                    <Input id="cn-lump-amt" inputMode="decimal" value={lump.taxable} onChange={(e) => setLump({ ...lump, taxable: e.target.value.replace(/[^\d.,]/g, "") })} className="h-9 text-right text-sm tabular-nums md:text-sm" />
                  </Field>
                  <Field label="Tax rate" htmlFor="cn-lump-rate">
                    <SelectField field="cn-lump-rate" value={String(lump.rate)} options={rates.map((r) => ({ value: String(r), label: `${r}%` }))} onChange={(v) => setLump({ ...lump, rate: Number(v) })} />
                  </Field>
                </div>
              )}
            </section>

            <section className={cn(card, "p-4")}>
              <h2 className="text-[13px] font-semibold">Tax & totals</h2>
              {built.ok ? (
                <dl className="mt-2 grid gap-1 text-[13px] tabular-nums">
                  <Pair k="Taxable value" v={formatINR(built.doc.taxable_paise)} row />
                  {built.doc.cgst_paise > 0 && <Pair k="CGST" v={formatINR(built.doc.cgst_paise)} row />}
                  {built.doc.sgst_paise > 0 && <Pair k="SGST" v={formatINR(built.doc.sgst_paise)} row />}
                  {built.doc.igst_paise > 0 && <Pair k="IGST" v={formatINR(built.doc.igst_paise)} row />}
                  {built.doc.round_off_paise !== 0 && <Pair k="Round off" v={formatINR(built.doc.round_off_paise)} row />}
                  <Pair k="Total credit" v={formatINR(total)} row strong />
                </dl>
              ) : (
                <p className="mt-2 text-[13px] text-muted-foreground">{built.error}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">Max creditable {formatINR(built.maxCreditable)}</p>
            </section>

            {built.ok && (
              <section className={cn(card, "grid gap-3 p-4")}>
                <h2 className="text-[13px] font-semibold">After issuing</h2>
                <p className="text-[13px] text-foreground/85">
                  {applies > 0 ? `${formatINR(applies)} will reduce ${summary.number}'s balance to ${formatINR(summary.balance - applies)}.` : `${summary.number} has nothing left to pay.`}
                  {leftOver > 0 && ` ${formatINR(leftOver)} will be left over for ${invoice.billTo.name || "the client"}.`}
                </p>
                {leftOver > 0 && (
                  <>
                    <div role="radiogroup" aria-label="Left-over credit" className="grid gap-1.5">
                      {(
                        [
                          ["credit", "Keep as client credit", summary.clientId ? "Apply it to their next invoice." : "This invoice has no saved client, so credit can't be applied to other invoices."],
                          ["refund", "Refund now", "Record the money you're paying back."],
                        ] as const
                      ).map(([v, label, hint]) => (
                        <button key={v} type="button" role="radio" aria-checked={after === v} disabled={v === "credit" && !summary.clientId} onClick={() => setAfter(v)} className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-50", after === v ? "border-brand/50 bg-brand/5" : "hover:bg-muted/40")}>
                          <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", after === v && "border-brand bg-brand text-white")}>{after === v && <CheckIcon className="size-3" />}</span>
                          <span className="grid gap-0.5">
                            <span className="font-medium">{label}</span>
                            <span className="text-xs text-muted-foreground">{hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    {after === "refund" && (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Refund date" htmlFor="cn-refund-date">
                          <DateField id="cn-refund-date" field="cn-refund-date" value={refund.date} max={today} onChange={(d) => setRefund({ ...refund, date: d })} />
                        </Field>
                        <Field label="Mode" htmlFor="cn-refund-mode">
                          <SelectField field="cn-refund-mode" value={refund.mode} options={PAYMENT_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))} onChange={(v) => setRefund({ ...refund, mode: v as PaymentMode })} />
                        </Field>
                        <Field label="Reference" htmlFor="cn-refund-ref">
                          <Input id="cn-refund-ref" maxLength={64} value={refund.reference} onChange={(e) => setRefund({ ...refund, reference: e.target.value })} className="h-9 text-sm md:text-sm" />
                        </Field>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-[13px] text-destructive">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" /> {error}
              </p>
            )}
          </div>

          {/* sticky footer */}
          <div className="flex shrink-0 items-center gap-2 border-t bg-background px-4 py-2.5">
            <span className="text-[13px] text-muted-foreground">
              Total credit <span className="text-base font-semibold text-foreground tabular-nums">{formatINR(total)}</span>
            </span>
            <Button variant="outline" className="ml-auto h-8 px-3 text-[13px]" disabled={!!busy} onClick={() => void save(false)}>
              Save draft
            </Button>
            <Button className="h-8 px-3 text-[13px]" disabled={!!busy || !built.ok || !!dateError} onClick={() => setConfirming(true)}>
              Issue credit note
            </Button>
          </div>
        </div>

        {/* preview */}
        <div className={cn("hidden min-h-0 flex-1 overflow-y-auto bg-muted/40 p-6 md:block dark:bg-black/25", view === "form" && "md:hidden")}>
          <div className="mx-auto max-w-[720px] overflow-hidden rounded-[4px] shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_24px_48px_-24px_rgb(0_0_0/0.35)]">
            <CreditNoteDocument note={preview} print />
          </div>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Issue a credit note for {formatINR(total)} against {summary.number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Issued credit notes can&apos;t be edited, only voided. It gets the next CN number.
              {leftOver > 0 && (after === "refund" ? ` A refund of ${formatINR(leftOver)} will be recorded.` : ` ${formatINR(leftOver)} will stay as client credit.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-8 text-[13px]" disabled={!!busy} onClick={(e) => { e.preventDefault(); void save(true) }}>
              {busy === "issue" && <LoaderCircleIcon className="animate-spin" />} Issue credit note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Pair({ k, v, strong, row }: { k: string; v: string; strong?: boolean; row?: boolean }) {
  return (
    <div className={cn(row ? "flex justify-between gap-3" : "grid")}>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn(strong ? "font-semibold" : "font-medium")}>{v}</dd>
    </div>
  )
}
