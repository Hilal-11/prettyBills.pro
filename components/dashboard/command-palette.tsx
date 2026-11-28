"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { motion } from "motion/react"
import {
  ArrowUpRightIcon,
  BellRingIcon,
  BuildingIcon,
  CalendarClockIcon,
  ClockIcon,
  CommandIcon,
  CornerDownLeftIcon,
  DownloadIcon,
  FilePlus2Icon,
  FileTextIcon,
  KeyboardIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  MoonIcon,
  ReceiptTextIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  TypeIcon,
  UserPlusIcon,
  WalletIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import type { SearchHit } from "@/app/api/search/route"
import { ClientChip } from "@/components/invoices/client-chip"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useTheme } from "@/hooks/use-theme"
import { readLocal, writeLocal } from "@/lib/client/local"
import { useKeyLabels } from "@/lib/client/platform"
import { navGroups } from "@/lib/dashboard/data"
import { formatMoney } from "@/lib/invoice/totals"
import { spring } from "@/lib/motion"

import type { SettingsTab } from "./dashboard-ui"
import { Kbd } from "./shortcuts-dialog"

type Scope = "all" | "invoices" | "clients" | "pages" | "actions"
const SCOPES: { id: Scope; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All", icon: SearchIcon },
  { id: "invoices", label: "Invoices", icon: FileTextIcon },
  { id: "clients", label: "Clients", icon: BuildingIcon },
  { id: "pages", label: "Pages", icon: ArrowUpRightIcon },
  { id: "actions", label: "Actions", icon: SparklesIcon },
]

type Entry = { key: string; title: string; sub?: string; icon?: LucideIcon; chip?: string; dot?: string; amount?: number; keywords?: string; run: () => void; hint?: string }
type Recent = { key: string; title: string; sub?: string; href: string; kind: SearchHit["kind"] | "page" }

const RECENT_KEY = "pb.search.recent"
const DOT: Record<string, string> = { draft: "bg-muted-foreground/60", sent: "bg-sky-500", overdue: "bg-red-500", paid: "bg-emerald-500", void: "bg-zinc-400" }
const STATUS: Record<string, string> = { draft: "Draft", sent: "Sent", overdue: "Overdue", paid: "Paid", void: "Void" }

/** Every word of the query appears somewhere in the text. */
const matches = (q: string, text: string) => {
  const t = text.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w))
}

/** The part of `text` that matched, in bold. */
function Hl({ text, q }: { text: string; q: string }) {
  const w = q.trim().split(/\s+/)[0]
  const i = w ? text.toLowerCase().indexOf(w.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-brand/15 px-px text-foreground dark:bg-brand/30">{text.slice(i, i + w.length)}</mark>
      {text.slice(i + w.length)}
    </>
  )
}

/**
 * ⌘K: one box to jump anywhere. Searches the user's invoices, clients and
 * receipts on the server (/api/search) and the app's pages and actions
 * locally. Empty, it shows recent picks, shortcuts and the latest records.
 * Tab moves between scopes; ↑ ↓ and Enter pick.
 */
export function CommandPalette({
  open,
  onOpenChange,
  openSettings,
  openShortcuts,
  openWhatsNew,
  openFeedback,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  openSettings: (tab?: SettingsTab) => void
  openShortcuts: () => void
  openWhatsNew: () => void
  openFeedback: () => void
}) {
  const router = useRouter()
  const { toggle } = useTheme()
  const { mod } = useKeyLabels()
  const [q, setQ] = React.useState("")
  const [scope, setScope] = React.useState<Scope>("all")
  const [hits, setHits] = React.useState<SearchHit[]>([])
  const [loading, setLoading] = React.useState(false)
  const [guest, setGuest] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)

  // recent picks, read fresh each time the palette opens
  const recent = React.useMemo(() => (open ? readLocal<Recent[]>(RECENT_KEY, []) : []), [open])

  React.useEffect(() => {
    if (!open || scope === "pages" || scope === "actions") return
    const ctrl = new AbortController()
    const t = setTimeout(
      () => {
        setLoading(true)
        fetch(`/api/search?q=${encodeURIComponent(q.trim())}&scope=${scope}`, { signal: ctrl.signal })
          .then(async (r) => {
            if (r.status === 401) {
              setGuest(true)
              setHits([])
              return
            }
            const d = (await r.json().catch(() => null)) as { hits?: SearchHit[] } | null
            setGuest(false)
            setHits(d?.hits ?? [])
          })
          .catch(() => {})
          .finally(() => !ctrl.signal.aborted && setLoading(false))
      },
      q ? 160 : 0
    )
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [open, q, scope])

  const close = () => onOpenChange(false)
  const go = (href: string, r?: Omit<Recent, "href">) => {
    if (r) {
      const next = [{ ...r, href }, ...readLocal<Recent[]>(RECENT_KEY, []).filter((x) => x.key !== r.key)].slice(0, 6)
      writeLocal(RECENT_KEY, next)
    }
    close()
    router.push(href)
  }
  const later = (fn: () => void) => () => {
    close()
    setTimeout(fn, 120) // let this dialog close before the next opens
  }

  const actions: Entry[] = [
    { key: "a-new", title: "New invoice", sub: "Start from your usual template", icon: FilePlus2Icon, keywords: "create make bill", run: () => go("/create") },
    { key: "a-client", title: "Add a client", sub: "GSTIN fills in the state", icon: UserPlusIcon, keywords: "new customer", run: () => go("/clients?new=1") },
    { key: "a-pay", title: "Record a payment", sub: "Against a sent invoice", icon: WalletIcon, keywords: "received paid money upi", run: () => go("/invoices?view=sent") },
    { key: "a-chase", title: "Chase overdue invoices", sub: "Remind on WhatsApp", icon: BellRingIcon, keywords: "late remind follow up", run: () => go("/invoices?view=overdue") },
    { key: "a-due", title: "Due in the next 30 days", icon: CalendarClockIcon, keywords: "upcoming", run: () => go("/invoices?view=upcoming") },
    {
      key: "a-export",
      title: "Export invoices as CSV",
      sub: "For your CA or Excel",
      icon: DownloadIcon,
      keywords: "download csv excel",
      run: () => {
        close()
        Object.assign(document.createElement("a"), { href: "/api/invoices/export", download: "" }).click()
      },
    },
    { key: "a-settings", title: "Settings", icon: SettingsIcon, hint: `${mod} ,`, keywords: "profile account", run: later(() => openSettings("profile")) },
    { key: "a-business", title: "Business details", sub: "Name, GSTIN, address, bank", icon: BuildingIcon, keywords: "gstin company settings", run: later(() => openSettings("business")) },
    { key: "a-font", title: "Change theme or font", sub: "Light, dark and interface font", icon: TypeIcon, keywords: "appearance preferences typeface", run: later(() => openSettings("preferences")) },
    { key: "a-dark", title: "Toggle dark mode", icon: MoonIcon, keywords: "theme light dark", run: () => toggle() },
    { key: "a-keys", title: "Keyboard shortcuts", icon: KeyboardIcon, hint: "?", keywords: "keys hotkeys", run: later(openShortcuts) },
    { key: "a-new-things", title: "What's new", icon: SparklesIcon, keywords: "changelog updates", run: later(openWhatsNew) },
    { key: "a-feedback", title: "Send feedback", icon: MessageSquareIcon, keywords: "bug idea support", run: later(openFeedback) },
  ]

  const pages: Entry[] = navGroups.flatMap((g) =>
    g.items.filter((item) => !item.soon && item.href).flatMap((item) => [
      { key: `p-${item.id}`, title: item.label, sub: g.label ?? "Workspace", icon: item.icon, keywords: item.href, run: () => (item.external ? window.open(item.href, "_blank", "noopener") : go(item.href!, { key: `p-${item.id}`, title: item.label, sub: "Page", kind: "page" })) },
      ...(item.children ?? []).map((c) => ({ key: `p-${c.id}`, title: `${item.label}: ${c.label}`, sub: g.label ?? item.label, icon: item.icon, keywords: c.href, run: () => go(c.href, { key: `p-${c.id}`, title: c.label, sub: "Page", kind: "page" as const }) })),
    ])
  )

  const fromHit = (h: SearchHit): Entry => ({
    key: `${h.kind}-${h.id}`,
    title: h.title,
    sub: h.kind === "invoice" ? `${h.sub} · ${STATUS[h.status] ?? h.status}` : h.sub,
    icon: h.kind === "invoice" ? FileTextIcon : h.kind === "receipt" ? ReceiptTextIcon : undefined,
    chip: h.kind === "client" ? h.title : undefined,
    dot: h.kind === "invoice" ? DOT[h.status] : undefined,
    amount: h.kind === "client" ? undefined : h.amount,
    run: () => go(h.href, { key: `${h.kind}-${h.id}`, title: h.title, sub: h.sub, kind: h.kind }),
  })

  const term = q.trim()
  const show = (s: Scope) => scope === "all" || scope === s
  const filter = (list: Entry[]) => (term ? list.filter((e) => matches(term, `${e.title} ${e.sub ?? ""} ${e.keywords ?? ""}`)) : list)
  const invoices = hits.filter((h) => h.kind === "invoice").map(fromHit)
  const clients = hits.filter((h) => h.kind === "client").map(fromHit)
  const receipts = hits.filter((h) => h.kind === "receipt").map(fromHit)
  const shownActions = show("actions") ? filter(actions).slice(0, term || scope === "actions" ? 20 : 5) : []
  const shownPages = show("pages") ? filter(pages).slice(0, term || scope === "pages" ? 30 : 6) : []
  const recents: Entry[] =
    !term && scope === "all"
      ? recent.map((r) => ({ key: `r-${r.key}`, title: r.title, sub: r.sub, icon: r.kind === "invoice" ? FileTextIcon : r.kind === "receipt" ? ReceiptTextIcon : r.kind === "page" ? ArrowUpRightIcon : undefined, chip: r.kind === "client" ? r.title : undefined, run: () => go(r.href, r) }))
      : []

  const groups: { heading: string; items: Entry[] }[] = [
    { heading: "Recent", items: recents },
    { heading: term ? "Actions" : "Quick actions", items: scope === "all" && term ? shownActions.slice(0, 4) : shownActions },
    { heading: term ? "Invoices" : "Latest invoices", items: show("invoices") ? invoices : [] },
    { heading: term ? "Clients" : "Recently updated clients", items: show("clients") ? clients : [] },
    { heading: "Receipts", items: scope === "all" ? receipts : [] },
    { heading: "Pages", items: shownPages },
  ].filter((g) => g.items.length)
  const empty = !groups.length && !loading

  const cycle = (dir: 1 | -1) => setScope((s) => SCOPES[(SCOPES.findIndex((x) => x.id === s) + dir + SCOPES.length) % SCOPES.length].id)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setQ("")
          setScope("all")
        }
      }}
    >
      <DialogContent showCloseButton={false} className="top-[12vh] max-h-[76vh] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[640px]">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search invoices, clients, receipts, pages and actions.</DialogDescription>
        <Command
          shouldFilter={false}
          loop
          className="flex min-h-0 flex-col"
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault()
              cycle(e.shiftKey ? -1 : 1)
            }
          }}
        >
          <div className="flex items-center gap-2.5 border-b px-4">
            {loading ? <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <SearchIcon className="size-4 shrink-0 text-muted-foreground" />}
            <Command.Input
              ref={input}
              value={q}
              onValueChange={setQ}
              placeholder={scope === "all" ? "Search invoices, clients, pages, or type a command" : `Search ${SCOPES.find((s) => s.id === scope)?.label.toLowerCase()}`}
              className="h-13 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {q ? (
              <button type="button" aria-label="Clear" onClick={() => setQ("")} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
                <XIcon className="size-3.5" />
              </button>
            ) : (
              <Kbd>Esc</Kbd>
            )}
          </div>

          <div role="radiogroup" aria-label="Search in" className="flex gap-1 overflow-x-auto border-b px-3 py-2">
            {SCOPES.map((s) => {
              const on = scope === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setScope(s.id)
                    input.current?.focus()
                  }}
                  className={cn("relative isolate inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors", on ? "border-transparent text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground")}
                >
                  {on && <motion.span layoutId="palette-scope" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-muted" />}
                  <s.icon className="size-3.5" />
                  {s.label}
                </button>
              )
            })}
          </div>

          <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]" style={{ maxHeight: "min(56vh, 460px)" }}>
            {guest && (scope === "all" || scope === "invoices" || scope === "clients") && (
              <p className="mx-2 mb-1 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">Log in to search your invoices, clients and receipts. Pages and actions work now.</p>
            )}
            {empty && (
              <div className="grid justify-items-center gap-1 px-6 py-10 text-center">
                <SearchIcon className="size-5 text-muted-foreground" />
                <p className="text-[13px] font-medium">Nothing matches “{term}”</p>
                <p className="text-xs text-muted-foreground">Try an invoice number, a client name, a GSTIN or a page.</p>
              </div>
            )}
            {groups.map((g) => (
              <Command.Group key={g.heading} heading={g.heading} className="mb-1 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground">
                {g.items.map((e) => (
                  <Command.Item
                    key={`${g.heading}-${e.key}`}
                    value={`${g.heading}-${e.key}`}
                    onSelect={e.run}
                    className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] outline-none data-[selected=true]:bg-muted"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground transition-colors group-data-[selected=true]:border-brand/30 group-data-[selected=true]:text-brand dark:group-data-[selected=true]:text-[#6da2ff]">
                      {e.chip ? <ClientChip name={e.chip} className="size-4" /> : e.icon ? <e.icon className="size-4" /> : <ClockIcon className="size-4" />}
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">
                        <Hl text={e.title} q={term} />
                      </span>
                      {e.sub && (
                        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {e.dot && <span className={cn("size-1.5 shrink-0 rounded-full", e.dot)} />}
                          <span className="truncate">
                            <Hl text={e.sub} q={term} />
                          </span>
                        </span>
                      )}
                    </span>
                    {e.amount !== undefined && <span className="shrink-0 text-xs font-medium tabular-nums">{formatMoney(e.amount, { whole: e.amount % 100 === 0 })}</span>}
                    {e.hint && <Kbd className="group-data-[selected=true]:hidden">{e.hint}</Kbd>}
                    <span className="hidden shrink-0 items-center gap-1 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-medium text-white group-data-[selected=true]:inline-flex">
                      Open <CornerDownLeftIcon className="size-3" />
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          <div className="flex items-center gap-4 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> Open
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>Tab</Kbd> Switch scope
            </span>
            <span className="ml-auto flex items-center gap-1">
              <CommandIcon className="size-3" /> <Kbd>{mod} K</Kbd> anywhere
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
