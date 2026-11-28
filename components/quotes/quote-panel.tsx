"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BanIcon, CheckIcon, CopyIcon, CopyPlusIcon, DownloadIcon, FileTextIcon, HistoryIcon, LinkIcon, LoaderCircleIcon, MailIcon, PencilIcon, ScrollTextIcon, XIcon } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { duplicateQuoteAction, markQuoteSentAction } from "@/app/(app)/quotes/actions"
import { whatsappUrl } from "@/components/invoice-editor/actions"
import { useToast } from "@/components/invoice-editor/toast"
import { Button, buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/billing/dates"
import { formatINR } from "@/lib/billing/money"
import { DISPLAY_LABEL, KIND_LABEL, quoteLabel } from "@/lib/billing/quotes"
import { computeInvoiceTotals } from "@/lib/invoice/totals"
import type { QuoteDetail } from "@/lib/server/db/quotes"

import { ConvertDialog } from "./convert-dialog"
import { MarkStatusDialog, ReviseDialog, VoidQuoteDialog } from "./quote-dialogs"
import { QuoteStatusBadge } from "./quote-status"

const when = (ts: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ts))

/** Everything about one quote beside its preview: status, answer, actions, revisions, conversions, activity. */
export function QuotePanel({ quote: q, publicUrl, viewingRevision }: { quote: QuoteDetail; publicUrl: string | null; viewingRevision: number | null }) {
  const router = useRouter()
  const toast = useToast()
  const [dialog, setDialog] = React.useState<null | "revise" | "void" | "accept" | "decline" | "convert-invoice" | "convert-proforma">(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const label = quoteLabel(q.number, q.revision)
  const word = q.kind === "proforma" ? "proforma" : "quote"
  const canConvert = q.status === "sent" || q.status === "accepted" || (q.status === "converted" && q.convertedPaise < q.total)
  const waiting = q.status === "sent"
  const total = computeInvoiceTotals(q.document).total

  async function duplicate() {
    setBusy("dup")
    const res = await duplicateQuoteAction(q.id, crypto.randomUUID())
    setBusy(null)
    if (!res.ok) return toast({ title: "Couldn't duplicate", description: res.error, tone: "error" })
    router.push(`/quotes/${res.id}/edit`)
  }
  async function copy() {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl).catch(() => {})
    toast({ title: "Link copied", description: publicUrl, tone: "success" })
  }
  async function markSent() {
    setBusy("sent")
    const res = await markQuoteSentAction(q.id)
    setBusy(null)
    if (!res.ok) return toast({ title: "Couldn't mark it sent", description: res.error, tone: "error" })
    toast({ title: `${label} marked sent`, tone: "success" })
  }

  return (
    <div className="grid gap-5 p-4 text-[13px]">
      {/* status */}
      <section aria-labelledby="q-status" className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="q-status" className="text-xs font-medium text-muted-foreground">
            {KIND_LABEL[q.kind]}
          </h2>
          <QuoteStatusBadge display={q.display} />
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatINR(q.total)}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Number</dt>
          <dd className="text-right font-medium tabular-nums">{label}</dd>
          <dt className="text-muted-foreground">Client</dt>
          <dd className="truncate text-right">{q.clientId ? <Link href={`/clients/${encodeURIComponent(q.clientId)}?tab=quotes`} className="hover:underline">{q.clientName}</Link> : "—"}</dd>
          <dt className="text-muted-foreground">Issued</dt>
          <dd className="text-right tabular-nums">{formatDate(q.issueDate)}</dd>
          {q.validUntil && (
            <>
              <dt className="text-muted-foreground">Valid until</dt>
              <dd className={cn("text-right tabular-nums", q.display === "expired" && "font-medium text-red-600 dark:text-red-400")}>
                {formatDate(q.validUntil)}
                {q.status === "sent" && q.daysLeft !== null && <span className="ml-1 text-muted-foreground">({q.daysLeft < 0 ? `expired ${-q.daysLeft}d ago` : q.daysLeft === 0 ? "today" : `${q.daysLeft}d left`})</span>}
              </dd>
            </>
          )}
          {q.sentAt && (
            <>
              <dt className="text-muted-foreground">Sent</dt>
              <dd className="text-right tabular-nums">{when(q.sentAt)}</dd>
            </>
          )}
          {q.viewedAt && (
            <>
              <dt className="text-muted-foreground">Viewed</dt>
              <dd className="text-right tabular-nums">{when(q.viewedAt)}</dd>
            </>
          )}
          {q.convertedPaise > 0 && (
            <>
              <dt className="text-muted-foreground">Invoiced</dt>
              <dd className="text-right tabular-nums">
                {formatINR(q.convertedPaise)} of {formatINR(q.total)}
              </dd>
            </>
          )}
        </dl>
        {q.respondedAt && (
          <div className={cn("mt-1 rounded-lg border px-3 py-2 text-xs", q.responseAction === "accepted" ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10")}>
            <p className="font-medium">
              {q.responseBy === "owner" ? `Marked ${q.responseAction} by ${q.responseName ?? "you"}` : `${q.responseAction === "accepted" ? "Accepted" : "Declined"} by ${q.responseName ?? "the client"}`}
              <span className="font-normal text-muted-foreground"> · {when(q.respondedAt)}</span>
            </p>
            {q.responseComment && <p className="mt-1 text-foreground/80">&ldquo;{q.responseComment}&rdquo;</p>}
            {q.responseRevision && q.revision > 1 && <p className="mt-1 text-muted-foreground">On revision {q.responseRevision}</p>}
          </div>
        )}
        {q.status === "void" && q.voidReason && <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Voided: {q.voidReason}</p>}
        {q.source && (
          <p className="text-xs text-muted-foreground">
            Made from {q.source.kind === "proforma" ? "proforma" : "quote"}{" "}
            <Link href={`/quotes/${q.source.id}`} className="font-medium text-foreground hover:underline">
              {q.source.number}
            </Link>
          </p>
        )}
      </section>

      {/* actions */}
      {viewingRevision === null && (
        <section aria-label="Actions" className="grid gap-1.5">
          {canConvert && (
            <div className="grid grid-cols-2 gap-1.5">
              <Button className="h-8 text-[13px]" onClick={() => setDialog("convert-invoice")}>
                <FileTextIcon /> To invoice
              </Button>
              {q.kind === "quote" ? (
                <Button variant="outline" className="h-8 text-[13px]" onClick={() => setDialog("convert-proforma")}>
                  <ScrollTextIcon /> To proforma
                </Button>
              ) : (
                <span />
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {(q.status === "sent" || q.status === "accepted" || q.status === "declined") && (
              <Button variant="outline" className="h-8 text-[13px]" onClick={() => setDialog("revise")}>
                <PencilIcon /> Revise
              </Button>
            )}
            <Button variant="outline" className="h-8 text-[13px]" disabled={busy === "dup"} onClick={() => void duplicate()}>
              {busy === "dup" ? <LoaderCircleIcon className="animate-spin" /> : <CopyPlusIcon />} Duplicate
            </Button>
            <a href={`/api/quotes/${q.id}/pdf`} className={cn(buttonVariants({ variant: "outline" }), "h-8 text-[13px]")}>
              <DownloadIcon /> PDF
            </a>
            {(q.status === "sent" || q.status === "accepted") && (
              <Link href={`/quotes/${q.id}/edit`} className={cn(buttonVariants({ variant: "outline" }), "h-8 text-[13px]")}>
                <MailIcon /> Email
              </Link>
            )}
            {publicUrl && (
              <>
                <Button variant="outline" className="h-8 text-[13px]" onClick={() => void copy()}>
                  <CopyIcon /> Copy link
                </Button>
                <a href={whatsappUrl(q.document, computeInvoiceTotals(q.document), publicUrl)} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline" }), "h-8 text-[13px]")}>
                  <FaWhatsapp className="text-emerald-600 dark:text-emerald-400" /> WhatsApp
                </a>
              </>
            )}
          </div>
          {q.status === "draft" && (
            <Button variant="outline" className="h-8 text-[13px]" disabled={busy === "sent"} onClick={() => void markSent()}>
              <LinkIcon /> Mark as sent
            </Button>
          )}
          {waiting && (
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="outline" className="h-8 text-[13px]" onClick={() => setDialog("accept")}>
                <CheckIcon /> Mark accepted
              </Button>
              {q.kind === "quote" && (
                <Button variant="outline" className="h-8 text-[13px]" onClick={() => setDialog("decline")}>
                  <XIcon /> Mark declined
                </Button>
              )}
            </div>
          )}
          {q.status !== "void" && q.status !== "converted" && (
            <Button variant="ghost" className="h-8 justify-start text-[13px] text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDialog("void")}>
              <BanIcon /> Void {word}
            </Button>
          )}
        </section>
      )}

      {/* conversions */}
      {q.conversions.length > 0 && (
        <section aria-labelledby="q-conv" className="grid gap-1.5">
          <h2 id="q-conv" className="text-xs font-medium text-muted-foreground">
            Converted to
          </h2>
          <ul className="divide-y rounded-lg border">
            {q.conversions.map((c) => (
              <li key={c.targetId} className="flex items-center gap-2 px-3 py-2">
                {c.targetType === "invoice" ? <FileTextIcon className="size-3.5 text-muted-foreground" /> : <ScrollTextIcon className="size-3.5 text-muted-foreground" />}
                <Link href={c.targetType === "invoice" ? `/invoices/${c.targetId}` : `/quotes/${c.targetId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {c.number || (c.targetType === "invoice" ? "Draft invoice" : "Draft proforma")}
                </Link>
                <span className="text-xs text-muted-foreground tabular-nums">{formatINR(c.amount, { decimals: false })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* revisions */}
      {q.revisions.length > 0 && (
        <section aria-labelledby="q-revs" className="grid gap-1.5">
          <h2 id="q-revs" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HistoryIcon className="size-3.5" /> Revisions
          </h2>
          <ul className="divide-y rounded-lg border">
            <li>
              <Link href={`/quotes/${q.id}`} aria-current={viewingRevision === null ? "page" : undefined} className={cn("flex items-center gap-2 px-3 py-2 hover:bg-muted/40", viewingRevision === null && "bg-muted/50")}>
                <span className="flex-1 font-medium">Rev {q.revision} · latest</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatINR(total, { decimals: false })}</span>
              </Link>
            </li>
            {q.revisions.map((r) => (
              <li key={r.revision}>
                <Link href={`/quotes/${q.id}?rev=${r.revision}`} aria-current={viewingRevision === r.revision ? "page" : undefined} className={cn("flex items-center gap-2 px-3 py-2 hover:bg-muted/40", viewingRevision === r.revision && "bg-muted/50")}>
                  <span className="flex-1">
                    Rev {r.revision} <span className="text-xs text-muted-foreground">· {DISPLAY_LABEL[r.status === "sent" ? "sent" : r.status]}, replaced {formatDate(r.createdAt.slice(0, 10))}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatINR(r.total, { decimals: false })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* activity */}
      <section aria-labelledby="q-act" className="grid gap-1.5">
        <h2 id="q-act" className="text-xs font-medium text-muted-foreground">
          Activity
        </h2>
        {q.activity.length ? (
          <ol className="grid gap-2.5 border-l pl-3">
            {q.activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute top-1.5 -left-[16.5px] size-2 rounded-full border-2 border-background bg-muted-foreground/50" aria-hidden />
                <p className="text-[13px]">{activityText(a.action, a.data, word)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{when(a.at)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">Nothing yet.</p>
        )}
      </section>

      <ConvertDialog quoteId={q.id} open={dialog === "convert-invoice" || dialog === "convert-proforma"} target={dialog === "convert-proforma" ? "proforma" : "invoice"} onOpenChange={(o) => !o && setDialog(null)} />
      <ReviseDialog id={q.id} number={label} accepted={q.status === "accepted"} open={dialog === "revise"} onOpenChange={(o) => !o && setDialog(null)} onDone={() => router.push(`/quotes/${q.id}/edit`)} />
      <VoidQuoteDialog id={q.id} number={q.number} open={dialog === "void"} onOpenChange={(o) => !o && setDialog(null)} />
      <MarkStatusDialog id={q.id} number={label} status={dialog === "decline" ? "declined" : "accepted"} open={dialog === "accept" || dialog === "decline"} onOpenChange={(o) => !o && setDialog(null)} />
    </div>
  )
}

function activityText(action: string, d: Record<string, unknown>, word: string) {
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "")
  switch (action) {
    case "quote.created":
      return d.from ? `Created from ${s("from")}` : d.duplicate_of ? `Created as a copy of ${s("duplicate_of")}` : `Created as ${s("number")}`
    case "quote.sent":
      return `Sent${s("via") && s("via") !== "manual" ? ` by ${s("via") === "whatsapp" ? "WhatsApp" : s("via")}` : " (marked as sent)"}${Number(d.revision) > 1 ? `, revision ${d.revision}` : ""}`
    case "quote.resent":
      return `Sent again${s("via") ? ` by ${s("via")}` : ""}`
    case "quote.viewed":
      return "Viewed by the client"
    case "quote.revised":
      return `Revision ${d.to} started (revision ${d.from} kept)`
    case "quote.accepted":
      return `Accepted by ${s("name") || "the client"}${d.expired ? " after it expired" : ""}${s("comment") ? `: “${s("comment")}”` : ""}`
    case "quote.declined":
      return `Declined${s("name") ? ` by ${s("name")}` : ""}${s("comment") ? `: “${s("comment")}”` : ""}`
    case "quote.marked_accepted":
      return `Marked accepted by ${s("by_name") || "you"}${s("note") ? `: “${s("note")}”` : ""}`
    case "quote.marked_declined":
      return `Marked declined by ${s("by_name") || "you"}${s("note") ? `: “${s("note")}”` : ""}`
    case "quote.converted":
      return `Converted to ${s("target") === "proforma" ? "a proforma" : "an invoice"} (${formatINR(Number(d.amount_paise) || 0, { decimals: false })})`
    case "quote.expired":
      return `Expired (valid until ${formatDate(s("valid_until"))})`
    case "quote.voided":
      return `Voided: ${s("reason")}`
    default:
      return `${word[0].toUpperCase()}${word.slice(1)} updated`
  }
}
