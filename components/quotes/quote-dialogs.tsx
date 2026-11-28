"use client"

import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"

import { reviseQuoteAction, setQuoteStatusAction, voidQuoteAction } from "@/app/(app)/quotes/actions"
import { Field } from "@/components/invoice-editor/fields"
import { useToast } from "@/components/invoice-editor/toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { QuoteResult } from "@/lib/server/db/quotes"

/** Mark accepted or declined by hand (a WhatsApp or phone answer), with an optional note. */
export function MarkStatusDialog({ id, number, status, open, onOpenChange, onDone }: { id: string; number: string; status: "accepted" | "declined"; open: boolean; onOpenChange: (o: boolean) => void; onDone?: (q: QuoteResult) => void }) {
  const toast = useToast()
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastOpen, setLastOpen] = React.useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setNote("")
      setError(null)
    }
  }
  async function submit() {
    setBusy(true)
    const res = await setQuoteStatusAction(id, status, note)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    onOpenChange(false)
    onDone?.(res.quote)
    toast({ title: status === "accepted" ? `${number} marked accepted` : `${number} marked declined`, tone: "success" })
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="gap-4 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Mark {number} {status}</DialogTitle>
          <DialogDescription>For an answer you got outside PrettyBills, like on WhatsApp or a call. It&apos;s logged with your name.</DialogDescription>
        </DialogHeader>
        <Field label={status === "accepted" ? "Note (optional)" : "Reason (optional)"} htmlFor="q-mark-note">
          <Textarea id="q-mark-note" rows={3} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={status === "accepted" ? "Confirmed on WhatsApp, 26 Nov" : "Went with another vendor"} className="min-h-20 resize-y text-sm md:text-sm" />
        </Field>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="-mx-5 -mb-5 p-4">
          <Button variant="outline" className="h-8 text-[13px]" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="h-8 text-[13px]" variant={status === "declined" ? "destructive" : "default"} disabled={busy} onClick={() => void submit()}>
            {busy && <LoaderCircleIcon className="animate-spin" />} Mark {status}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Void: kept on record with its number, link turned off. */
export function VoidQuoteDialog({ id, number, open, onOpenChange, onDone }: { id: string; number: string; open: boolean; onOpenChange: (o: boolean) => void; onDone?: (q: QuoteResult) => void }) {
  const toast = useToast()
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastOpen, setLastOpen] = React.useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setReason("")
      setError(null)
    }
  }
  async function submit() {
    setBusy(true)
    const res = await voidQuoteAction(id, reason)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    onOpenChange(false)
    onDone?.(res.quote)
    toast({ title: `${number} voided`, description: "Its number stays used and the link is off.", tone: "success" })
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="gap-4 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Void {number}?</DialogTitle>
          <DialogDescription>It stays in your records with its number, and the client&apos;s link stops working. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <Field label="Reason" required htmlFor="q-void-reason" help="3 to 200 characters, kept with the quote">
          <Input id="q-void-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Client chose another vendor" className="h-9 text-sm" autoFocus />
        </Field>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="-mx-5 -mb-5 p-4">
          <Button variant="outline" className="h-8 text-[13px]" disabled={busy} onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button variant="destructive" className="h-8 text-[13px]" disabled={busy || reason.trim().length < 3} onClick={() => void submit()}>
            {busy && <LoaderCircleIcon className="animate-spin" />} Void
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Revise: the version the client saw is kept; the next revision opens as a draft. Accepted quotes warn first. */
export function ReviseDialog({ id, number, accepted, open, onOpenChange, onDone }: { id: string; number: string; accepted: boolean; open: boolean; onOpenChange: (o: boolean) => void; onDone?: (q: QuoteResult) => void }) {
  const toast = useToast()
  const [busy, setBusy] = React.useState(false)
  async function submit() {
    setBusy(true)
    const res = await reviseQuoteAction(id, accepted)
    setBusy(false)
    if (!res.ok) return toast({ title: "Couldn't revise", description: res.error, tone: "error" })
    onOpenChange(false)
    onDone?.(res.quote)
    toast({ title: `Revision ${res.quote.revision} started`, description: "Edit it, then send it again. The client keeps seeing the last version until then.", tone: "success" })
  }
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{accepted ? `Revise accepted ${number}?` : `Revise ${number}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {accepted
              ? "The client already accepted this version. Revising it sets it back to a draft revision, and they'll need to accept it again."
              : "The version you sent is kept, read-only. You'll edit the next revision and send it again; it keeps the same number."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={(e) => (e.preventDefault(), void submit())}>
            {busy && <LoaderCircleIcon className="animate-spin" />} {accepted ? "Revise anyway" : "Start revision"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
