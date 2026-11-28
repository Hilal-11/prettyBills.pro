"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import {
  CheckIcon,
  ChevronDownIcon,
  CloudCheckIcon,
  CloudOffIcon,
  Columns2Icon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  LoaderIcon,
  MailIcon,
  PanelRightIcon,
  PrinterIcon,
  Redo2Icon,
  RotateCcwIcon,
  SendIcon,
  Share2Icon,
  TriangleAlertIcon,
  Undo2Icon,
  WalletIcon,
  WifiOffIcon,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SupportButton } from "@/components/support-button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ProBadge, ProMark } from "@/components/app/premium"
import { InvoiceDocument } from "@/components/landing/invoice-document"
import { localDateToISO, relativeTime } from "@/lib/invoice/format"
import { CATEGORY_ORDER, TEMPLATES, templateMeta } from "@/lib/invoice/templates"
import { ease } from "@/lib/motion"
import { emailInPlan } from "@/lib/pricing"
import { QuoteStatusBadge } from "@/components/quotes/quote-status"
import { quoteLabel } from "@/lib/billing/quotes"

import { downloadPdf, printPdf, shareLink, whatsappUrl } from "./actions"
import { Segmented } from "./fields"
import { useToast } from "./toast"
import type { EditorApi, QuoteState, View } from "./use-editor"

const ctl = "h-8 text-[13px]"

/** Quotes › Drafts / Sent / Accepted… (the list's tab for this status). */
function quoteCrumb(ed: EditorApi) {
  const kind = ed.mode === "proforma" ? "proforma" : "quote"
  const base = kind === "proforma" ? "/quotes?kind=proforma" : "/quotes"
  const join = (tab: string) => `${base}${base.includes("?") ? "&" : "?"}tab=${tab}`
  const d = ed.quote?.display ?? "draft"
  const tab = d === "draft" ? ["Drafts", "draft"] : d === "accepted" ? ["Accepted", "accepted"] : d === "declined" ? ["Declined", "declined"] : d === "converted" ? ["Converted", "converted"] : d === "void" ? ["Void", "void"] : d === "expired" ? ["Expired", "expired"] : ["Open", "open"]
  return { root: { label: kind === "proforma" ? "Proforma" : "Quotes", href: base }, tab: { label: tab[0], href: join(tab[1]) } }
}

function crumbFor(status: string) {
  if (status === "draft") return { label: "Drafts", href: "/invoices?view=draft" }
  if (status === "paid") return { label: "Paid", href: "/invoices?view=paid" }
  return { label: "Sent", href: "/invoices?view=sent" }
}

export function TopBar({ ed, wide, onSend }: { ed: EditorApi; wide: boolean; onSend: () => void }) {
  const locked = !emailInPlan(ed.plan)
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger className="-ml-1 text-foreground/70" />
      <Separator orientation="vertical" className="mr-1 h-4 data-vertical:self-center" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap text-[13px]">
          {!ed.guest && ed.isQuote && (
            <>
              <BreadcrumbItem className="hidden xl:inline-flex">
                <BreadcrumbLink render={<Link href={quoteCrumb(ed).root.href} />}>{quoteCrumb(ed).root.label}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden xl:inline-flex" />
              <BreadcrumbItem className="hidden 2xl:inline-flex">
                <BreadcrumbLink render={<Link href={quoteCrumb(ed).tab.href} />}>{quoteCrumb(ed).tab.label}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden 2xl:inline-flex" />
            </>
          )}
          {!ed.guest && !ed.isQuote && (
            <>
              <BreadcrumbItem className="hidden 2xl:inline-flex">
                <BreadcrumbLink render={<Link href="/invoices" />}>Invoices</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden 2xl:inline-flex" />
              <BreadcrumbItem className="hidden 2xl:inline-flex">
                <BreadcrumbLink render={<Link href={crumbFor(ed.invoice.status).href} />}>{crumbFor(ed.invoice.status).label}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden 2xl:inline-flex" />
            </>
          )}
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-semibold tabular-nums">
              {ed.isQuote ? (ed.invoice.number ? quoteLabel(ed.invoice.number, ed.invoice.revision) : ed.mode === "proforma" ? "New proforma" : "New quote") : ed.invoice.number || "Untitled"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {ed.isQuote ? <QuoteStatusBadge display={ed.quote?.display ?? "draft"} className="ml-1 hidden sm:inline-flex" /> : <StatusPill ed={ed} />}
      {ed.guest ? <GuestIndicator ed={ed} /> : <SaveIndicator ed={ed} />}

      <div className="ml-auto flex items-center gap-1.5">
        <TemplatePicker ed={ed} />
        <PageColor ed={ed} />
        {wide && <ViewMenu ed={ed} />}
        <div className="hidden items-center lg:flex">
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Undo (Ctrl+Z)" disabled={!ed.canUndo} onClick={ed.undo} className="text-foreground/75" />}>
              <Undo2Icon />
            </TooltipTrigger>
            <TooltipContent>Undo · Ctrl+Z</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Redo (Ctrl+Shift+Z)" disabled={!ed.canRedo} onClick={ed.redo} className="text-foreground/75" />}>
              <Redo2Icon />
            </TooltipTrigger>
            <TooltipContent>Redo · Ctrl+Shift+Z</TooltipContent>
          </Tooltip>
        </div>
        <Separator orientation="vertical" className="mx-0.5 hidden h-4 data-vertical:self-center sm:block" />
        {!ed.guest && ["sent", "viewed", "partially_paid"].includes(ed.invoice.status) && ed.totals.balanceDue > 0 && (
          <Button variant="outline" className={cn(ctl, "hidden gap-1.5 px-2.5 xl:inline-flex")} onClick={() => ed.setRecordOpen(true)}>
            <WalletIcon /> Record payment
          </Button>
        )}
        <PdfButton ed={ed} />
        <ShareMenu ed={ed} onEmail={onSend} locked={locked} />
        <Button
          className={cn(ctl, "px-3")}
          onClick={onSend}
          disabled={ed.isQuote && !!ed.quote && ed.quote.status !== "draft" && ed.quote.status !== "sent"}
          title={locked ? "Emailing is a Pro feature" : undefined}
          aria-label={locked ? `${sendWord(ed)} (Pro)` : undefined}
        >
          <SendIcon /> <span className="hidden sm:inline">{sendWord(ed)}</span>
          {locked && <ProMark />}
        </Button>
        <Separator orientation="vertical" className="mx-0.5 hidden h-4 data-vertical:self-center sm:block" />
        <SupportButton section="dashboard" size="compact" />
      </div>
    </header>
  )
}

const sendWord = (ed: EditorApi) => (ed.mode === "quote" ? "Send quote" : ed.mode === "proforma" ? "Send proforma" : "Send invoice")

/* ------------------------------ status ------------------------------ */

function StatusPill({ ed }: { ed: EditorApi }) {
  const [today, setToday] = React.useState<string | null>(null)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- today is client-only (no Date during prerender)
  React.useEffect(() => setToday(localDateToISO(new Date())), [])
  let s: string = ed.invoice.status
  if ((s === "sent" || s === "viewed") && today && ed.invoice.dueDate < today && ed.totals.balanceDue > 0) s = "overdue"
  const style: Record<string, [string, string]> = {
    draft: ["Draft", "bg-brand"],
    sent: ["Sent", "bg-sky-500"],
    viewed: ["Viewed", "bg-violet-500"],
    partially_paid: ["Part paid", "bg-teal-500"],
    paid: ["Paid", "bg-emerald-500"],
    overdue: ["Overdue", "bg-red-500"],
    void: ["Void", "bg-zinc-500"],
  }
  const [label, dot] = style[s] ?? style.draft
  return (
    <span className="ml-1 hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-foreground/85 sm:inline-flex">
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  )
}

function SaveIndicator({ ed }: { ed: EditorApi }) {
  const { status, savedAt } = ed.save
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clock for the relative time tooltip
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [savedAt])
  const content =
    status === "saving" ? (
      <>
        <LoaderIcon className="size-3 animate-spin" /> Saving…
      </>
    ) : status === "offline" ? (
      <>
        <WifiOffIcon className="size-3.5" /> Offline – changes kept locally
      </>
    ) : status === "error" ? (
      <>
        <TriangleAlertIcon className="size-3.5 text-destructive" /> Couldn&apos;t save
        <button type="button" onClick={ed.retrySave} className="ml-1 inline-flex items-center gap-0.5 font-semibold text-foreground underline-offset-2 hover:underline">
          <RotateCcwIcon className="size-3" /> Retry
        </button>
      </>
    ) : (
      <>
        <CloudCheckIcon className="size-3.5" /> Saved
      </>
    )
  return (
    <span className="hidden items-center gap-1 text-[11px] text-foreground/70 md:inline-flex" aria-live="polite" title={savedAt && now ? `Saved ${relativeTime(savedAt, now)}` : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease }} className="inline-flex items-center gap-1 whitespace-nowrap">
          {content}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** Guests: nothing is saved. One click explains why and offers a free account. */
function GuestIndicator({ ed }: { ed: EditorApi }) {
  return (
    <button
      type="button"
      onClick={() => ed.askAccount("save")}
      title="You're a guest, so this invoice isn't saved. Log in to keep it."
      className="group ml-0.5 hidden shrink-0 items-center gap-1.5 rounded-full border border-dashed border-foreground/20 py-0.5 pr-2 pl-1.5 text-[11px] whitespace-nowrap text-foreground/70 transition-colors hover:border-brand/50 hover:text-foreground md:inline-flex"
    >
      <CloudOffIcon className="size-3.5" />
      Not saved
      <span className="font-semibold text-brand group-hover:underline dark:text-[#6da2ff]">Log in</span>
    </button>
  )
}

/* ----------------------------- template ----------------------------- */

function MiniThumb({ ed, slug, className }: { ed: EditorApi; slug: string; className?: string }) {
  return (
    <span className={cn("block shrink-0 overflow-hidden rounded-[3px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.12)]", className)} aria-hidden>
      <InvoiceDocument invoice={ed.invoice} template={slug} fill decorative />
    </span>
  )
}

function TemplatePicker({ ed }: { ed: EditorApi }) {
  const [open, setOpen] = React.useState(false)
  const current = templateMeta(ed.invoice.templateId)
  const Icon = current.icon
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className={cn(ctl, "gap-1.5 px-2")} aria-label={`Template: ${current.name}`} />}>
        <Icon className="size-3.5 text-foreground/70" />
        <span className="hidden max-w-28 truncate md:inline">{current.name}</span>
        {current.recommended && <span className="hidden rounded bg-brand/10 px-1 py-px text-[10px] font-medium text-brand xl:inline dark:bg-brand/20 dark:text-[#6da2ff]">Recommended</span>}
        <ChevronDownIcon className="size-3.5 text-foreground/50" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <Command>
          <CommandInput placeholder="Search templates" />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No templates match.</CommandEmpty>
            {CATEGORY_ORDER.map((cat) => {
              const list = TEMPLATES.filter((t) => t.category === cat)
              if (!list.length) return null
              return (
                <CommandGroup key={cat} heading={cat}>
                  {list.map((t) => {
                    const TIcon = t.icon
                    const selected = t.slug === ed.invoice.templateId
                    return (
                      <CommandItem
                        key={t.slug}
                        value={`${t.name} ${t.category} ${t.description} ${t.tags.join(" ")}`}
                        data-checked={selected}
                        onSelect={() => {
                          ed.update((d) => void (d.templateId = t.slug))
                          setOpen(false)
                        }}
                        className="items-start gap-2.5 py-2"
                      >
                        <MiniThumb ed={ed} slug={t.slug} className="w-10" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-[13px] font-medium">
                            <TIcon className="size-3.5 text-foreground/60" />
                            {t.name}
                            {t.recommended && <span className="rounded bg-brand/10 px-1 py-px text-[10px] text-brand dark:bg-brand/20 dark:text-[#6da2ff]">Recommended</span>}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t.description}</span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {t.tags.map((tag) => (
                              <span key={tag} className="rounded border px-1 text-[10px] text-foreground/70">
                                {tag}
                              </span>
                            ))}
                          </span>
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}
          </CommandList>
          <Link href="/templates" className="flex items-center justify-between border-t px-3 py-2 text-xs font-medium text-brand hover:bg-muted dark:text-[#6da2ff]">
            Browse all templates <span aria-hidden>→</span>
          </Link>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function PageColor({ ed }: { ed: EditorApi }) {
  return (
    <Segmented
      label="Page colour"
      layoutId="page-color"
      value={ed.invoice.pageColor}
      className="hidden h-8 items-center md:inline-flex"
      options={[
        { value: "white", label: <><span className="size-2.5 rounded-full border border-black/20 bg-white" /> White</> },
        { value: "black", label: <><span className="size-2.5 rounded-full border border-white/30 bg-[#0b0b0c]" /> Black</> },
      ]}
      onChange={(v) => ed.update((d) => void (d.pageColor = v))}
    />
  )
}

const VIEWS: { value: View; label: string; icon: typeof FileTextIcon; key: string }[] = [
  { value: "form", label: "Form", icon: PanelRightIcon, key: "Alt+1" },
  { value: "preview", label: "Preview", icon: FileTextIcon, key: "Alt+2" },
  { value: "both", label: "Both", icon: Columns2Icon, key: "Alt+3" },
]

function ViewMenu({ ed }: { ed: EditorApi }) {
  const current = VIEWS.find((v) => v.value === ed.view) ?? VIEWS[2]
  const Icon = current.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className={cn(ctl, "gap-1.5 px-2")} aria-label={`View: ${current.label}`} />}>
        <Icon className="size-3.5" />
        <span className="hidden lg:inline">{current.label}</span>
        <ChevronDownIcon className="size-3.5 text-foreground/50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>View</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={ed.view} onValueChange={(v) => ed.setView(v as View)}>
            {VIEWS.map((v) => (
              <DropdownMenuRadioItem key={v.value} value={v.value} className="gap-2">
                <v.icon className="size-3.5" /> {v.label}
                <DropdownMenuShortcut>{v.key}</DropdownMenuShortcut>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------ actions ----------------------------- */

function PdfButton({ ed }: { ed: EditorApi }) {
  const toast = useToast()
  const [busy, setBusy] = React.useState(false)
  const run = async (kind: "download" | "print" | "colorless") => {
    setBusy(true)
    try {
      if (kind === "print") await printPdf(ed.invoice)
      else await downloadPdf(ed.invoice, { colorless: kind === "colorless" })
    } catch (error) {
      toast({ title: "Couldn't create the PDF", description: (error as Error).message, tone: "error", duration: 8000, action: { label: "Retry", onClick: () => void run(kind) } })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex">
      <Button variant="outline" className={cn(ctl, "rounded-r-none border-r-0 px-2.5")} disabled={busy} onClick={() => void run("download")}>
        {busy ? <LoaderIcon className="animate-spin" /> : <DownloadIcon />}
        <span className="hidden sm:inline">PDF</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" className="h-8 w-7 rounded-l-none" aria-label="More PDF options" disabled={busy} />}>
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onClick={() => void run("download")}>
            <DownloadIcon /> Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void run("print")}>
            <PrinterIcon /> Print
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void run("colorless")} disabled={ed.invoice.pageColor === "white"}>
            <FileTextIcon /> Download without colour
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ShareMenu({ ed, onEmail, locked }: { ed: EditorApi; onEmail: () => void; locked: boolean }) {
  const toast = useToast()
  const [busy, setBusy] = React.useState(false)

  async function withLink<T>(fn: (url: string) => T, via: "link" | "whatsapp" = "link") {
    // links need the invoice stored online, which needs an account
    if (ed.guest) return ed.askAccount("share")
    setBusy(true)
    try {
      const res = await shareLink(ed.invoice, undefined, { quoteKey: ed.quoteKey, via })
      if (res.token !== ed.invoice.publicToken) ed.applyServer({ publicToken: res.token })
      // sharing a draft quote sends it
      if (ed.isQuote && res.quote) ed.setQuote({ ...(res.quote as Partial<QuoteState>), display: ed.quote?.display === "draft" || !ed.quote ? "sent" : ed.quote.display })
      return fn(res.url)
    } catch (error) {
      toast({ title: "Couldn't create the link", description: (error as Error).message, tone: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className={cn(ctl, "px-2.5")} disabled={busy} />}>
        {busy ? <LoaderIcon className="animate-spin" /> : <Share2Icon />}
        <span className="hidden sm:inline">Share</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem
          onClick={() =>
            void withLink(async (url) => {
              await navigator.clipboard.writeText(url).catch(() => {})
              toast({ title: "Link copied", description: url, tone: "success" })
            })
          }
        >
          <CopyIcon /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (ed.guest) return ed.askAccount("share")
            const win = window.open("about:blank", "_blank")
            void withLink((url) => {
              const wa = whatsappUrl(ed.invoice, ed.totals, url)
              if (win) win.location.href = wa
              else window.open(wa, "_blank", "noopener")
            }, "whatsapp")
          }}
        >
          <FaWhatsapp className="text-emerald-600 dark:text-emerald-400" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEmail}>
          <MailIcon /> Email
          {locked && <ProBadge className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            void downloadPdf(ed.invoice).catch((e: Error) => toast({ title: "Couldn't create the PDF", description: e.message, tone: "error" }))
          }
        >
          <DownloadIcon /> Download PDF
        </DropdownMenuItem>
        {!ed.guest && <DropdownMenuSeparator />}
        {!ed.guest && (
        <DropdownMenuCheckboxItem
          checked={ed.invoice.linkActive}
          onCheckedChange={(v) => {
            ed.update((d) => void (d.linkActive = !!v))
            void shareLink({ ...ed.invoice, linkActive: !!v }, !!v)
              .then(() => toast({ title: v ? "Public link turned on" : "Public link turned off", tone: "success" }))
              .catch(() => toast({ title: "Couldn't update the link", tone: "error" }))
          }}
        >
          Link active
        </DropdownMenuCheckboxItem>
        )}
        {ed.invoice.publicToken && (
          <DropdownMenuItem render={<a href={`/${ed.isQuote ? "q" : "i"}/${ed.invoice.publicToken}`} target="_blank" rel="noopener" />}>
            <CheckIcon className="opacity-0" /> Open public page
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
