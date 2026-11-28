"use client"

import * as React from "react"
import { CheckCircle2Icon, LoaderCircleIcon, XCircleIcon } from "lucide-react"

import { Field } from "@/components/invoice-editor/fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Answer = { status: "accepted" | "declined"; name: string | null; comment: string | null; at: string }

const when = (ts: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ts))

/**
 * Accept / Decline on the public quote page. Accepting asks for a name and a
 * confirmation; declining takes an optional reason. After answering, the
 * buttons give way to a thank-you with the answer and its time.
 */
export function QuoteRespond({ token, kind, clientName, business, initial }: { token: string; kind: "quote" | "proforma"; clientName: string; business: string; initial: Answer | null }) {
  const [answer, setAnswer] = React.useState<Answer | null>(initial)
  const [open, setOpen] = React.useState<null | "accept" | "decline">(null)
  const [name, setName] = React.useState("")
  const [comment, setComment] = React.useState("")
  const [confirm, setConfirm] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const word = kind === "proforma" ? "proforma invoice" : "quotation"

  async function submit(action: "accept" | "decline") {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/public/quote/${token}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, name, comment, confirm }),
    }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as { error?: string; status?: "accepted" | "declined"; respondedAt?: string; name?: string | null; comment?: string | null } | null
    setBusy(false)
    if (!res?.ok || !body?.status) return setError(body?.error ?? "Couldn't reach the server. Check your connection and try again.")
    setAnswer({ status: body.status, name: body.name ?? null, comment: body.comment ?? null, at: body.respondedAt ?? new Date().toISOString() })
    setOpen(null)
  }

  if (answer)
    return (
      <div role="status" className={`rounded-xl border p-5 ${answer.status === "accepted" ? "border-emerald-500/30 bg-emerald-500/5" : "bg-background"}`}>
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          {answer.status === "accepted" ? <CheckCircle2Icon className="size-4.5 text-emerald-600" /> : <XCircleIcon className="size-4.5 text-muted-foreground" />}
          {answer.status === "accepted" ? "Accepted, thank you" : "Declined"}
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {answer.name ? `${answer.name} · ` : ""}
          {when(answer.at)}
        </p>
        {answer.comment && <p className="mt-2 text-[13px]">&ldquo;{answer.comment}&rdquo;</p>}
        <p className="mt-3 text-xs text-muted-foreground">{answer.status === "accepted" ? `${business} has been told and will be in touch.` : `${business} has been told. Thanks for letting them know.`}</p>
      </div>
    )

  return (
    <div className="grid gap-2">
      <Button className="h-10 w-full text-sm" onClick={() => (setOpen("accept"), setError(null))}>
        <CheckCircle2Icon /> Accept {kind === "proforma" ? "proforma" : "quote"}
      </Button>
      {kind === "quote" && (
        <button type="button" onClick={() => (setOpen("decline"), setError(null))} className="h-8 rounded-md text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
          Decline
        </button>
      )}

      <Dialog open={open === "accept"} onOpenChange={(o) => !busy && setOpen(o ? "accept" : null)}>
        <DialogContent className="gap-4 p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Accept this {word}</DialogTitle>
            <DialogDescription>{business} will be told straight away.</DialogDescription>
          </DialogHeader>
          <Field label="Your name" required htmlFor="qr-name">
            <Input id="qr-name" value={name} maxLength={100} autoComplete="name" onChange={(e) => setName(e.target.value)} className="h-9 text-sm" autoFocus />
          </Field>
          <Field label="Comment (optional)" htmlFor="qr-comment">
            <Textarea id="qr-comment" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Looks good, go ahead" className="min-h-20 resize-y text-sm md:text-sm" />
          </Field>
          <label className="flex items-start gap-2 text-[13px]">
            <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} className="mt-0.5 data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand" />
            <span>
              I accept this {word} on behalf of {clientName || "my business"}
            </span>
          </label>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="-mx-5 -mb-5 p-4">
            <Button variant="outline" className="h-9" disabled={busy} onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button className="h-9" disabled={busy || name.trim().length < 2 || !confirm} onClick={() => void submit("accept")}>
              {busy && <LoaderCircleIcon className="animate-spin" />} Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "decline"} onOpenChange={(o) => !busy && setOpen(o ? "decline" : null)}>
        <DialogContent className="gap-4 p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Decline this quotation?</DialogTitle>
            <DialogDescription>A reason helps {business} send a better offer. It&apos;s optional.</DialogDescription>
          </DialogHeader>
          <Field label="Reason (optional)" htmlFor="qr-reason">
            <Textarea id="qr-reason" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Over our budget for now" className="min-h-20 resize-y text-sm md:text-sm" autoFocus />
          </Field>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="-mx-5 -mb-5 p-4">
            <Button variant="outline" className="h-9" disabled={busy} onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button variant="destructive" className="h-9" disabled={busy} onClick={() => void submit("decline")}>
              {busy && <LoaderCircleIcon className="animate-spin" />} Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
