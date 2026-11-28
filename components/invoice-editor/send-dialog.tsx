"use client"

import * as React from "react"
import Link from "next/link"
import { CrownIcon, LoaderIcon, RotateCcwIcon, SendIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/invoice/format"
import { formatMoney } from "@/lib/invoice/totals"
import { RX } from "@/lib/invoice/validate"
import { upgradeHref } from "@/lib/pricing"
import { quoteEmailSubject, quoteLabel } from "@/lib/billing/quotes"

import { sendInvoice } from "./actions"
import { Field } from "./fields"
import { useToast } from "./toast"
import type { EditorApi, QuoteState } from "./use-editor"

const PLACEHOLDERS = ["{client_name}", "{invoice_no}", "{amount}", "{due_date}", "{link}"] as const
const QUOTE_PLACEHOLDERS = ["{client_name}", "{quote_no}", "{amount}", "{valid_until}", "{link}"] as const

const splitEmails = (s: string) =>
  s
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)

export function SendDialog({ ed, open, onOpenChange }: { ed: EditorApi; open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast()
  const inv = ed.invoice
  const q = inv.quote
  const amount = formatMoney(q ? ed.totals.total : ed.totals.balanceDue, { whole: true })
  const due = formatDate(inv.dueDate, inv.dateFormat)
  const until = q?.validUntil ? formatDate(q.validUntil, inv.dateFormat) : ""
  const number = q ? quoteLabel(inv.number || "(new)", inv.revision) : inv.number
  const word = q ? (q.kind === "proforma" ? "proforma invoice" : q.title === "Estimate" ? "estimate" : "quotation") : "invoice"

  const defaults = React.useCallback(
    () => ({
      to: inv.billTo.email ?? "",
      cc: "",
      bcc: "",
      subject: q ? quoteEmailSubject(q.kind, number, inv.from.name, amount, q.title) : `Invoice ${inv.number} from ${inv.from.name} – ${amount} due ${due}`,
      message: q
        ? `Hi {client_name},\n\nPlease find our ${word} {quote_no} for {amount}${until ? ", valid until {valid_until}" : ""}.\n\n${q.kind === "quote" ? "You can view and accept it online" : "View it online"}: {link}\n\nThank you,\n${inv.signature?.signatoryName || inv.from.name}`
        : `Hi {client_name},\n\nPlease find invoice {invoice_no} for {amount}, due on {due_date}.\n\nView and pay online: {link}\n\nThank you,\n${inv.signature?.signatoryName || inv.from.name}`,
      attachPdf: true,
      includeLink: true,
      copyMe: false,
    }),
    [inv, q, number, word, until, amount, due]
  )

  const [form, setForm] = React.useState(defaults)
  const [showCc, setShowCc] = React.useState(false)
  const [state, setState] = React.useState<{ busy: boolean; error?: string; upgrade?: boolean }>({ busy: false })
  const [lastOpen, setLastOpen] = React.useState(false)
  const messageRef = React.useRef<HTMLTextAreaElement>(null)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(defaults())
      setState({ busy: false })
    }
  }

  const fill = (text: string) =>
    text
      .replaceAll("{client_name}", inv.billTo.name)
      .replaceAll("{invoice_no}", inv.number)
      .replaceAll("{quote_no}", number)
      .replaceAll("{amount}", amount)
      .replaceAll("{due_date}", due)
      .replaceAll("{valid_until}", until)

  function insert(ph: string) {
    const el = messageRef.current
    const at = el?.selectionStart ?? form.message.length
    const next = form.message.slice(0, at) + ph + form.message.slice(el?.selectionEnd ?? at)
    setForm({ ...form, message: next })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + ph.length, at + ph.length)
    })
  }

  async function submit() {
    const to = splitEmails(form.to)
    const cc = splitEmails(form.cc)
    const bcc = splitEmails(form.bcc)
    const bad = [...to, ...cc, ...bcc].find((e) => !RX.email.test(e))
    if (!to.length) return setState({ busy: false, error: "Add at least one recipient" })
    if (bad) return setState({ busy: false, error: `"${bad}" isn't a valid email` })
    setState({ busy: true })
    try {
      const res = await sendInvoice(
        inv,
        {
        to,
        cc,
        bcc,
        subject: fill(form.subject),
        message: fill(form.message),
        attachPdf: form.attachPdf,
        includeLink: form.includeLink,
        copyMe: form.copyMe,
        },
        { quoteKey: ed.quoteKey }
      )
      if (q) {
        const sent = (res.quote ?? {}) as Partial<QuoteState>
        ed.setQuote({ ...sent, publicToken: res.publicToken ?? sent.publicToken ?? null })
      } else ed.markSent({ status: res.status, sentAt: res.sentAt, ...(res.publicToken ? { publicToken: res.publicToken } : {}) })
      if (res.delivered) ed.countEmail()
      onOpenChange(false)
      toast({
        title: res.delivered ? `${q ? word[0].toUpperCase() + word.slice(1) : "Invoice"} emailed to ${to[0]}${to.length > 1 ? ` and ${to.length - 1} more` : ""}` : "Saved to the local outbox",
        description: res.delivered ? `${res.summary}. Replies go to your business email.` : `Email isn't set up on this server, so nothing was delivered. The ${q ? word : "invoice"} is marked Sent.`,
        tone: "success",
        duration: 7000,
        action: res.publicToken ? { label: "View", onClick: () => window.open(`/${q ? "q" : "i"}/${res.publicToken}`, "_blank", "noopener") } : undefined,
      })
    } catch (error) {
      setState({ busy: false, error: (error as Error).message, upgrade: !!(error as { upgrade?: string }).upgrade })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !state.busy && onOpenChange(o)}>
      <DialogContent className="gap-4 p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            Send {q ? word : "invoice"} {number}
          </DialogTitle>
          <DialogDescription>
            {q ? `${amount}${until ? ` · valid until ${until}` : ""}` : `${amount} due ${due}`} · {inv.billTo.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field
            label="To"
            required
            help="Separate multiple emails with commas"
            aside={
              !showCc && (
                <button type="button" className="text-xs font-medium text-foreground/70 hover:text-foreground" onClick={() => setShowCc(true)}>
                  Add CC / BCC
                </button>
              )
            }
          >
            <Input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} type="email" multiple className="h-9 text-sm" autoFocus />
          </Field>
          {showCc && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="CC">
                <Input value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} className="h-9 text-sm" />
              </Field>
              <Field label="BCC">
                <Input value={form.bcc} onChange={(e) => setForm({ ...form, bcc: e.target.value })} className="h-9 text-sm" />
              </Field>
            </div>
          )}
          <Field label="Subject">
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Message">
            <Textarea ref={messageRef} rows={7} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="min-h-36 resize-y text-sm md:text-sm" />
            <div className="flex flex-wrap gap-1.5" aria-label="Insert placeholder">
              {(q ? QUOTE_PLACEHOLDERS : PLACEHOLDERS).map((p) => (
                <button key={p} type="button" onClick={() => insert(p)} className="rounded-full border px-2 py-0.5 font-mono text-[11px] text-foreground/75 hover:bg-muted hover:text-foreground">
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid gap-2 text-[13px]">
            {(
              [
                ["attachPdf", "Attach PDF"],
                ["includeLink", q ? (q.kind === "quote" ? "Include link to view and accept online" : "Include link to view online") : "Include link to view and pay online"],
                ["copyMe", `Send me a copy${inv.from.email ? ` (${inv.from.email})` : ""}`],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2">
                <Checkbox checked={form[k]} onCheckedChange={(v) => setForm({ ...form, [k]: !!v })} className="data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand" />
                {label}
              </label>
            ))}
          </div>
          {state.error && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
              <span>
                {state.error}
                {state.upgrade && (
                  <Link href={upgradeHref("email", typeof window === "undefined" ? undefined : window.location.pathname)} className="ml-1 font-semibold underline underline-offset-2">
                    See Pro plans
                  </Link>
                )}
              </span>
            </p>
          )}
        </div>

        <DialogFooter className="-mx-5 -mb-5 p-4 sm:items-center">
          {ed.plan?.pro && (
            <span className="mr-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              <CrownIcon className="size-3.5 text-amber-500" />
              {ed.plan.emails.used.toLocaleString("en-IN")} of {ed.plan.emails.limit.toLocaleString("en-IN")} emails this month
            </span>
          )}
          <Button variant="outline" className="h-9" disabled={state.busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="h-9" disabled={state.busy} onClick={() => void submit()}>
            {state.busy ? <LoaderIcon className="animate-spin" /> : state.error ? <RotateCcwIcon /> : <SendIcon />}
            {state.busy ? "Sending…" : state.error ? "Retry" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
