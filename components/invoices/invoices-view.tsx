"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckBigIcon,
  CircleDotIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  FilePenLineIcon,
  HashIcon,
  IndianRupeeIcon,
  ListFilterIcon,
  LoaderCircleIcon,
  type LucideIcon,
  PencilLineIcon,
  PlusIcon,
  SearchXIcon,
  SendIcon,
  Settings2Icon,
  Trash2Icon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"

import { bulkInvoicesAction } from "@/app/(app)/invoices/actions"
import { Actions } from "@/components/app/invoice-list"
import { ListSearch } from "@/components/app/list-controls"
import { StatusBadge } from "@/components/app/status"
import { DateField } from "@/components/invoice-editor/fields"
import { useToast } from "@/components/invoice-editor/toast"
import { ModeIcon } from "@/components/payments/mode-icon"
import { MultiPick } from "@/components/payments/filter-bar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { dateIST, formatDate, PRESET_LABEL, type DatePreset } from "@/lib/billing/dates"
import {
  CALC_LABEL,
  CALCS_FOR,
  calculate,
  hasFilters,
  invoiceQueryString,
  MAX_PAGES,
  paiseToRupees,
  rupeesToPaise,
  type Calc,
  type ColumnKind,
  type InvoiceQuery,
  type InvoiceSort,
  type InvoiceView,
} from "@/lib/billing/invoice-query"
import { MODE_LABEL, type PaymentMode } from "@/lib/billing/modes"
import { invoicesChanged } from "@/lib/client/workspace"
import { useStored } from "@/lib/client/use-stored"
import type { InvoiceSummary } from "@/lib/data/types"
import { formatMoney } from "@/lib/invoice/totals"
import { spring } from "@/lib/motion"

import { ClientChip } from "./client-chip"

export type Methods = Record<string, { mode: PaymentMode; modes: number }>

const money = (p: number) => formatMoney(p, { whole: p % 100 === 0 })
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`
const day = (iso: string | null) => (iso ? (iso.length > 10 ? dateIST(iso) : iso) : null)
const Muted = ({ children = "—" }: { children?: React.ReactNode }) => <span className="text-muted-foreground/70">{children}</span>

const STATUS_LABEL: Record<string, string> = { draft: "Draft", sent: "Sent", viewed: "Viewed", partially_paid: "Part paid", paid: "Paid", void: "Void", overdue: "Overdue" }
const counted = (i: InvoiceSummary, v: number) => (i.status === "void" ? null : v)

/* -------------------------------- columns ------------------------------- */

type ColId = "client" | "status" | "amount" | "paid" | "balance" | "issued" | "due" | "paidOn" | "method" | "sent" | "viewed" | "updated"
type Col = {
  id: ColId
  label: string
  icon: LucideIcon
  kind: ColumnKind
  width: number
  sort?: InvoiceSort
  right?: boolean
  value: (i: InvoiceSummary, methods: Methods) => number | string | null
  cell: (i: InvoiceSummary, methods: Methods) => React.ReactNode
}

function Due({ i }: { i: InvoiceSummary }) {
  if (!i.dueDate) return <Muted />
  const open = (i.bucket === "sent" || i.bucket === "overdue") && i.balanceDue > 0 && i.daysPastDue !== null
  const title = `Due ${formatDate(i.dueDate)}`
  if (open && i.daysPastDue! > 0)
    return (
      <span title={title} className="font-medium text-red-600 dark:text-red-400">
        {days(i.daysPastDue!)} late
      </span>
    )
  if (open && i.daysPastDue === 0)
    return (
      <span title={title} className="font-medium text-amber-700 dark:text-amber-400">
        Due today
      </span>
    )
  if (open && i.daysPastDue! >= -30) return <span title={title}>In {days(-i.daysPastDue!)}</span>
  return <span className={cn(i.bucket === "paid" || i.status === "void" ? "text-muted-foreground" : "")}>{formatDate(i.dueDate)}</span>
}

const COLUMNS: Col[] = [
  {
    id: "client",
    label: "Client",
    icon: UsersIcon,
    kind: "text",
    width: 150,
    sort: "client",
    value: (i) => i.clientName || null,
    cell: (i) =>
      i.clientName ? (
        <span className="flex min-w-0 items-center gap-2">
          <ClientChip name={i.clientName} />
          <span className="truncate">{i.clientName}</span>
        </span>
      ) : (
        <Muted>No client yet</Muted>
      ),
  },
  { id: "status", label: "Status", icon: CircleDotIcon, kind: "text", width: 104, value: (i) => STATUS_LABEL[i.bucket === "overdue" ? "overdue" : i.status], cell: (i) => <StatusBadge invoice={i} /> },
  { id: "amount", label: "Amount", icon: IndianRupeeIcon, kind: "money", width: 116, sort: "amount", right: true, value: (i) => counted(i, i.total), cell: (i) => <span className={cn("font-medium", i.status === "void" && "text-muted-foreground line-through")}>{money(i.total)}</span> },
  { id: "paid", label: "Paid", icon: CircleCheckBigIcon, kind: "money", width: 112, right: true, value: (i) => counted(i, i.amountPaid), cell: (i) => (i.amountPaid ? money(i.amountPaid) : <Muted />) },
  {
    id: "balance",
    label: "Balance due",
    icon: WalletIcon,
    kind: "money",
    width: 120,
    sort: "balance",
    right: true,
    value: (i) => counted(i, i.status === "draft" ? i.total : i.balanceDue),
    cell: (i) => (i.status === "void" || !i.balanceDue ? <Muted /> : <span className={cn("font-medium", i.bucket === "overdue" && "text-red-600 dark:text-red-400")}>{money(i.balanceDue)}</span>),
  },
  { id: "issued", label: "Issued", icon: CalendarIcon, kind: "date", width: 104, sort: "issued", value: (i) => i.issueDate, cell: (i) => formatDate(i.issueDate) },
  { id: "due", label: "Due", icon: CalendarClockIcon, kind: "date", width: 112, sort: "due", value: (i) => i.dueDate, cell: (i) => <Due i={i} /> },
  { id: "paidOn", label: "Paid on", icon: CalendarCheckIcon, kind: "date", width: 104, sort: "paid", value: (i) => day(i.paidAt), cell: (i) => (i.paidAt ? formatDate(day(i.paidAt)) : <Muted />) },
  {
    id: "method",
    label: "Method",
    icon: CreditCardIcon,
    kind: "text",
    width: 108,
    value: (i, m) => (m[i.id] ? MODE_LABEL[m[i.id].mode] : null),
    cell: (i, m) => {
      const p = m[i.id]
      if (!p) return <Muted />
      return (
        <span className="flex min-w-0 items-center gap-1.5" title={p.modes > 1 ? `Last paid by ${MODE_LABEL[p.mode]}; ${p.modes} different methods in all` : undefined}>
          <ModeIcon mode={p.mode} className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{MODE_LABEL[p.mode]}</span>
          {p.modes > 1 && <span className="shrink-0 rounded bg-muted px-1 text-[11px] text-muted-foreground">+{p.modes - 1}</span>}
        </span>
      )
    },
  },
  { id: "sent", label: "Sent", icon: SendIcon, kind: "date", width: 104, value: (i) => day(i.sentAt), cell: (i) => (i.sentAt ? formatDate(day(i.sentAt)) : <Muted />) },
  {
    id: "viewed",
    label: "Opened",
    icon: EyeIcon,
    kind: "date",
    width: 104,
    value: (i) => day(i.viewedAt),
    cell: (i) => (i.viewedAt ? <span className="text-violet-700 dark:text-violet-400">{formatDate(day(i.viewedAt))}</span> : i.status === "draft" || i.status === "void" ? <Muted /> : <Muted>Not yet</Muted>),
  },
  { id: "updated", label: "Last edited", icon: PencilLineIcon, kind: "date", width: 108, sort: "updated", value: (i) => day(i.updatedAt), cell: (i) => formatDate(day(i.updatedAt)) },
]

/** The invoice number column is always shown; its footer can count. */
const NUMBER_COL = { id: "number", kind: "text" as ColumnKind, value: (i: InvoiceSummary) => i.number || null }

const DEFAULT_HIDDEN: ColId[] = ["paid", "sent", "viewed", "updated"]
const DEFAULT_CALCS: Partial<Record<string, Calc>> = { amount: "sum", balance: "sum" }
const NO_FLAGS = { compact: false }

/** Sorting a column the first time: names A→Z, money and dates biggest/newest first, due dates soonest first. */
const firstDir = (s: InvoiceSort) => (s === "number" || s === "client" || s === "due" ? "asc" : "desc")

/* --------------------------------- view --------------------------------- */

type Props = {
  query: InvoiceQuery
  counts: Record<InvoiceView, number>
  rows: InvoiceSummary[]
  total: number
  methods: Methods
  clients: { id: string; name: string }[]
  kpis: React.ReactNode
}

/**
 * The invoices table: tabs with counts, search, client and date/amount
 * filters, sortable columns you can show or hide, a footer that sums (or
 * averages, counts…) any column, multi-select with bulk actions, and export.
 * The server reads and sorts; this component owns what's on screen.
 */
export function InvoicesView({ query, counts, rows, total, methods, clients, kpis }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()
  const [pending, start] = React.useTransition()
  const [hidden, setHidden] = useStored<ColId[]>("pb.invoices.hidden", DEFAULT_HIDDEN)
  const [calcs, setCalcs] = useStored<Partial<Record<string, Calc>>>("pb.invoices.calcs", DEFAULT_CALCS)
  const [flags, setFlags] = useStored("pb.invoices.flags", NO_FLAGS)
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set())
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [bulkBusy, setBulkBusy] = React.useState<null | "send" | "delete">(null)
  const lastClicked = React.useRef<number | null>(null)
  const shift = React.useRef(false)

  const go = React.useCallback(
    (patch: Partial<InvoiceQuery>, push = false) => {
      const qs = invoiceQueryString(query, patch)
      const url = `${pathname}${qs ? `?${qs}` : ""}`
      start(() => (push ? router.push(url, { scroll: false }) : router.replace(url, { scroll: false })))
    },
    [query, router, pathname]
  )

  const cols = COLUMNS.filter((c) => !hidden.includes(c.id))
  // only rows still on screen count as picked (a filter may have removed some)
  const ids = React.useMemo(() => new Set(rows.map((r) => r.id)), [rows])
  const selected = React.useMemo(() => new Set([...picked].filter((id) => ids.has(id))), [picked, ids])
  const chosen = rows.filter((r) => selected.has(r.id))
  const scope = chosen.length ? chosen : rows
  const drafts = chosen.filter((r) => r.status === "draft")
  const readyDrafts = drafts.filter((r) => r.missingFields === 0)
  const hasMore = rows.length < total

  // "/" jumps to search, Escape clears the selection
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.closest("input, textarea, select, [contenteditable=true]")
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>("[data-list-search]")?.focus()
      }
      if (e.key === "Escape" && !typing && !document.querySelector("[role=dialog],[role=menu]")) setPicked(new Set())
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const toggle = (index: number, on: boolean) => {
    setPicked((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)))
      const from = shift.current && lastClicked.current !== null ? Math.min(lastClicked.current, index) : index
      const to = shift.current && lastClicked.current !== null ? Math.max(lastClicked.current, index) : index
      for (let k = from; k <= to; k++) {
        if (on) next.add(rows[k].id)
        else next.delete(rows[k].id)
      }
      return next
    })
    lastClicked.current = index
  }

  const openRow = (e: React.MouseEvent<HTMLTableRowElement>, id: string) => {
    const target = e.target as HTMLElement
    // clicks inside menus and dialogs (portalled, but React bubbles them here) and on controls aren't row clicks
    if (!e.currentTarget.contains(target) || target.closest("a, button, input, label, [role=checkbox], [data-row-skip]")) return
    if (window.getSelection()?.toString()) return
    if (e.metaKey || e.ctrlKey) window.open(`/invoices/${id}`, "_blank", "noopener")
    else router.push(`/invoices/${id}`)
  }

  const bulk = async (kind: "send" | "delete", list: InvoiceSummary[]) => {
    setBulkBusy(kind)
    const r = await bulkInvoicesAction(
      kind,
      list.map((i) => i.id)
    ).catch(() => ({ ok: false as const, error: "You seem to be offline. Try again." }))
    setBulkBusy(null)
    if (!r.ok) return toast({ title: r.error, tone: "error" })
    invoicesChanged()
    setPicked(new Set())
    const noun = (n: number) => `${n} invoice${n === 1 ? "" : "s"}`
    toast({
      title: kind === "send" ? `${noun(r.done)} marked as sent` : `${noun(r.done)} deleted`,
      description: r.skipped ? `${r.skipped} skipped: ${kind === "send" ? "not ready to send" : "only drafts can be deleted"}.` : undefined,
      tone: "success",
      duration: 3000,
    })
  }

  const exportHref = `/api/invoices/export?${invoiceQueryString(query, {})}`
  const minWidth = 40 + 40 + 132 + cols.reduce((s, c) => s + c.width, 0) + 44
  const filtered = hasFilters(query)
  const allPicked = rows.length > 0 && selected.size === rows.length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
        <Tabs query={query} counts={counts} go={go} base={pathname} />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {pending && <LoaderCircleIcon aria-label="Loading" className="size-3.5 animate-spin text-muted-foreground" />}
          <ListSearch placeholder="Search invoices" className="sm:w-56" />
          <MultiPick icon={UsersIcon} label="Client" all="All clients" options={clients.map((c) => ({ value: c.id, label: c.name }))} value={query.clients} onChange={(c) => go({ clients: c })} searchable />
          <FilterMenu query={query} go={go} />
          <ViewMenu hidden={hidden} setHidden={setHidden} compact={flags.compact} setCompact={(compact) => setFlags({ ...flags, compact })} reset={() => {
            setHidden(DEFAULT_HIDDEN)
            setCalcs(DEFAULT_CALCS)
            setFlags(NO_FLAGS)
          }} />
          <a href={exportHref} download className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-2.5 text-[13px] font-normal")} title="Download what's shown as CSV (opens in Excel)">
            <DownloadIcon className="text-muted-foreground" /> <span className="hidden sm:inline">Export</span>
          </a>
          <Link href="/create" className={cn(buttonVariants(), "h-8 gap-1.5 px-3 text-[13px]")}>
            <PlusIcon /> <span className="hidden sm:inline">New invoice</span>
          </Link>
        </div>
      </div>

      {kpis}

      {(filtered || query.clients.length > 0) && <FilterChips query={query} clients={clients} go={go} total={total} />}

      {/* table */}
      {rows.length === 0 ? (
        <Empty view={query.view} filtered={filtered} clear={() => go({ q: "", clients: [], preset: "all", from: null, to: null, min: null, max: null })} />
      ) : (
        <div className={cn("relative min-h-0 flex-1 overflow-auto transition-opacity", pending && "opacity-60")}>
          <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]" style={{ minWidth }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 40 }} />
              <col style={{ width: 132 }} />
              {cols.map((c) => (
                <col key={c.id} style={{ width: c.width }} />
              ))}
              <col style={{ width: 44 }} />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr>
                <th scope="col" className={cn(th, "sticky left-0 z-10 px-0")}>
                  <span className="grid place-items-center">
                    <Checkbox aria-label={allPicked ? "Unselect all" : "Select all shown"} checked={allPicked} indeterminate={selected.size > 0 && !allPicked} onCheckedChange={(on) => setPicked(on ? new Set(rows.map((r) => r.id)) : new Set())} />
                  </span>
                </th>
                <th scope="col" className={cn(th, "sticky left-10 z-10 px-0 text-center")}>
                  <span className="sr-only">Row</span>
                </th>
                <HeaderCell label="Invoice" icon={HashIcon} sort="number" query={query} go={go} className="sticky left-20 z-10" />
                {cols.map((c) => (
                  <HeaderCell key={c.id} label={c.label} icon={c.icon} sort={c.sort} right={c.right} query={query} go={go} />
                ))}
                <th scope="col" className={cn(th, "sticky right-0 z-10 border-r-0")}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv, index) => {
                const on = selected.has(inv.id)
                return (
                  <tr
                    key={inv.id}
                    data-selected={on || undefined}
                    onClick={(e) => openRow(e, inv.id)}
                    className="group/row cursor-pointer [--row:var(--background)] hover:[--row:color-mix(in_oklab,var(--muted)_70%,var(--background))] data-selected:[--row:color-mix(in_oklab,var(--brand)_7%,var(--background))]"
                  >
                    <td className={cn(td, "sticky left-0 z-[1] px-0", flags.compact && "h-8")} onClickCapture={(e) => (shift.current = e.shiftKey)} onMouseDown={(e) => e.shiftKey && e.preventDefault()}>
                      <span className="grid place-items-center">
                        <Checkbox aria-label={`Select ${inv.number || "draft"}`} checked={on} onCheckedChange={(v) => toggle(index, v)} />
                      </span>
                    </td>
                    <td className={cn(td, "sticky left-10 z-[1] px-0 text-center text-xs text-muted-foreground tabular-nums")}>{index + 1}</td>
                    <td className={cn(td, "sticky left-20 z-[1]")}>
                      <Link href={`/invoices/${inv.id}`} className="font-medium tabular-nums outline-none hover:underline focus-visible:underline">
                        {inv.number || <span className="text-muted-foreground">No number</span>}
                      </Link>
                      {inv.status === "draft" && inv.missingFields > 0 && (
                        <span title={`${inv.missingFields} required field${inv.missingFields === 1 ? "" : "s"} to fill in`} className="ml-1.5 inline-grid size-4 place-items-center rounded-full bg-amber-500/15 align-middle text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          {inv.missingFields}
                        </span>
                      )}
                    </td>
                    {cols.map((c) => (
                      <td key={c.id} className={cn(td, c.right && "text-right tabular-nums", c.kind === "date" && "tabular-nums")}>
                        {c.cell(inv, methods)}
                      </td>
                    ))}
                    <td className={cn(td, "sticky right-0 z-[1] border-r-0 px-1 text-right")} data-row-skip>
                      <Actions inv={inv} view="all" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td colSpan={2} className={cn(tf, "sticky left-0 z-10 px-2 text-[11px] text-muted-foreground tabular-nums")}>
                  {chosen.length ? `${chosen.length} picked` : hasMore ? `${rows.length} of ${total}` : ""}
                </td>
                <CalcCell col={{ ...NUMBER_COL, label: "Invoice" }} rows={scope} methods={methods} calc={calcs.number ?? "none"} setCalc={(c) => setCalcs({ ...calcs, number: c })} picked={chosen.length > 0} className="sticky left-20 z-10" />
                {cols.map((c) => (
                  <CalcCell key={c.id} col={c} rows={scope} methods={methods} calc={calcs[c.id] ?? "none"} setCalc={(v) => setCalcs({ ...calcs, [c.id]: v })} picked={chosen.length > 0} />
                ))}
                <td className={cn(tf, "sticky right-0 z-10 border-r-0")} />
              </tr>
            </tfoot>
          </table>
          {hasMore && <LoadMore shown={rows.length} total={total} page={query.page} pending={pending} more={() => go({ page: query.page + 1 })} />}
        </div>
      )}

      {/* bulk actions for picked rows */}
      <AnimatePresence>
        {chosen.length > 0 && (
          <motion.div
            role="toolbar"
            aria-label="Selected invoices"
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 12, x: "-50%" }}
            transition={spring}
            className="fixed bottom-16 left-1/2 z-40 flex items-center gap-1 rounded-xl border bg-popover p-1.5 text-[13px] text-popover-foreground shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]"
          >
            <span className="px-2 font-medium tabular-nums">{chosen.length} selected</span>
            <span className="h-4 w-px bg-border" />
            <a href={`/api/invoices/export?ids=${chosen.map((r) => r.id).join(",")}`} download className={cn(buttonVariants({ variant: "ghost" }), bulkBtn)}>
              <DownloadIcon /> Export
            </a>
            {readyDrafts.length > 0 && (
              <Button variant="ghost" className={bulkBtn} disabled={!!bulkBusy} onClick={() => bulk("send", readyDrafts)} title="For drafts already shared as a PDF, link or on WhatsApp">
                {bulkBusy === "send" ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />} Mark {readyDrafts.length} as sent
              </Button>
            )}
            {drafts.length > 0 && (
              <Button variant="ghost" className={cn(bulkBtn, "text-red-600 hover:text-red-600 dark:text-red-400")} disabled={!!bulkBusy} onClick={() => setConfirmDelete(true)}>
                {bulkBusy === "delete" ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />} Delete {drafts.length} draft{drafts.length === 1 ? "" : "s"}
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => setPicked(new Set())}>
              <XIcon />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {drafts.length} draft{drafts.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {drafts
                .slice(0, 4)
                .map((d) => d.number || "Untitled")
                .join(", ")}
              {drafts.length > 4 ? ` and ${drafts.length - 4} more` : ""} will be deleted. Sent invoices aren&apos;t touched: they stay on record for GST. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-8 text-[13px]"
              onClick={() => {
                setConfirmDelete(false)
                void bulk("delete", drafts)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const th = "h-9 border-r border-b border-border/70 bg-background px-3 text-left text-xs font-normal whitespace-nowrap text-muted-foreground"
const td = "h-10 overflow-hidden border-r border-b border-border/50 bg-(--row) px-3 text-ellipsis whitespace-nowrap transition-colors"
const tf = "h-9 border-t border-r border-border/70 bg-background px-3"
const bulkBtn = "h-8 gap-1.5 px-2.5 text-[13px]"

/* --------------------------------- tabs --------------------------------- */

const TABS: { view: InvoiceView; label: string; danger?: boolean }[] = [
  { view: "all", label: "All" },
  { view: "draft", label: "Drafts" },
  { view: "sent", label: "Sent" },
  { view: "overdue", label: "Overdue", danger: true },
  { view: "paid", label: "Paid" },
  { view: "upcoming", label: "Upcoming" },
  { view: "void", label: "Void" },
]

const TAB_HINT: Partial<Record<InvoiceView, string>> = {
  sent: "Sent, not yet paid and not late",
  overdue: "Past their due date with money still owed",
  upcoming: "Falling due in the next 30 days",
  void: "Cancelled, kept on record",
}

function Tabs({ query, counts, go, base }: { query: InvoiceQuery; counts: Record<InvoiceView, number>; go: (p: Partial<InvoiceQuery>, push?: boolean) => void; base: string }) {
  return (
    <nav aria-label="Invoice views" className="-mx-1 max-w-full overflow-x-auto px-1">
      <ul className="flex items-center gap-0.5">
        {TABS.filter((t) => t.view !== "void" || counts.void > 0 || query.view === "void").map((t) => {
          const on = query.view === t.view
          const n = counts[t.view]
          const qs = invoiceQueryString(query, { view: t.view })
          return (
            <li key={t.view}>
              <Link
                href={`${base}${qs ? `?${qs}` : ""}`}
                scroll={false}
                aria-current={on ? "page" : undefined}
                title={TAB_HINT[t.view]}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                  e.preventDefault()
                  go({ view: t.view }, true)
                }}
                className={cn("relative isolate inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors", on ? "font-medium text-foreground" : "text-foreground/60 hover:text-foreground")}
              >
                {on && <motion.span layoutId="invoice-tabs" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-muted/70" />}
                {t.label}
                <span className={cn("text-xs tabular-nums", t.danger && n > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{n}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/* ------------------------------- header cell ------------------------------ */

function HeaderCell({ label, icon: Icon, sort, right, query, go, className }: { label: string; icon: LucideIcon; sort?: InvoiceSort; right?: boolean; query: InvoiceQuery; go: (p: Partial<InvoiceQuery>) => void; className?: string }) {
  const on = !!sort && query.sort === sort
  const content = (
    <>
      <Icon className="size-3.5 shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
      {on && (query.dir === "asc" ? <ArrowUpIcon className="size-3 shrink-0 text-foreground" /> : <ArrowDownIcon className="size-3 shrink-0 text-foreground" />)}
    </>
  )
  return (
    <th scope="col" aria-sort={on ? (query.dir === "asc" ? "ascending" : "descending") : undefined} className={cn(th, className)}>
      {sort ? (
        <button
          type="button"
          onClick={() => go({ sort, dir: on ? (query.dir === "asc" ? "desc" : "asc") : firstDir(sort) })}
          className={cn("-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1.5 rounded px-1 py-1 transition-colors hover:text-foreground", right && "flex-row-reverse text-right", on && "text-foreground")}
          title={`Sort by ${label.toLowerCase()}`}
        >
          {right ? (
            <>
              {on && (query.dir === "asc" ? <ArrowUpIcon className="size-3 shrink-0" /> : <ArrowDownIcon className="size-3 shrink-0" />)}
              <span className="truncate">{label}</span>
              <Icon className="size-3.5 shrink-0 opacity-80" />
            </>
          ) : (
            content
          )}
        </button>
      ) : (
        <span className={cn("flex items-center gap-1.5", right && "justify-end")}>{content}</span>
      )}
    </th>
  )
}

/* ------------------------------- footer cell ------------------------------ */

function CalcCell({
  col,
  rows,
  methods,
  calc,
  setCalc,
  picked,
  className,
}: {
  col: { id: string; label: string; kind: ColumnKind; value: (i: InvoiceSummary, m: Methods) => number | string | null; right?: boolean }
  rows: InvoiceSummary[]
  methods: Methods
  calc: Calc
  setCalc: (c: Calc) => void
  picked: boolean
  className?: string
}) {
  const options = CALCS_FOR[col.kind]
  const active = options.includes(calc) ? calc : "none"
  const result = active === "none" ? null : calculate(active, rows.map((r) => col.value(r, methods)))
  const shown =
    result === null
      ? "—"
      : typeof result === "string"
        ? formatDate(result)
        : col.kind === "money" && (active === "sum" || active === "avg" || active === "min" || active === "max")
          ? formatMoney(result, { whole: true })
          : result.toLocaleString("en-IN")
  return (
    <td className={cn(tf, "px-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              title={active === "none" ? `Calculate ${col.label.toLowerCase()}` : `${CALC_LABEL[active]} of ${picked ? "selected" : "shown"} rows`}
              className={cn("flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-xs whitespace-nowrap transition-colors hover:bg-muted", col.right && "justify-end")}
            />
          }
        >
          {active === "none" ? (
            <span className="flex items-center gap-1 text-muted-foreground/70">
              <ChevronDownIcon className="size-3" /> Calculate
            </span>
          ) : (
            <span className="truncate">
              <span className="text-muted-foreground">{CALC_LABEL[active]} </span>
              <span className="font-medium tabular-nums">{shown}</span>
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={col.right ? "end" : "start"} side="top" className="min-w-40 rounded-xl p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs">{col.label}</DropdownMenuLabel>
            {options.map((o) => (
              <DropdownMenuItem key={o} className="gap-2 py-1.5 text-[13px]" onClick={() => setCalc(o)}>
                <CheckIcon className={cn("size-3.5", o !== active && "opacity-0")} />
                {o === "none" ? "Don't calculate" : CALC_LABEL[o]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  )
}

/* ------------------------------ filter menus ------------------------------ */

const ISSUED_PRESETS: DatePreset[] = ["all", "this_month", "last_month", "last_30", "this_fy", "last_fy"]

function FilterMenu({ query, go }: { query: InvoiceQuery; go: (p: Partial<InvoiceQuery>) => void }) {
  const [open, setOpen] = React.useState(false)
  const [preset, setPreset] = React.useState<DatePreset>(query.preset)
  const [from, setFrom] = React.useState(query.from ?? "")
  const [to, setTo] = React.useState(query.to ?? "")
  const [min, setMin] = React.useState(query.min === null ? "" : paiseToRupees(query.min))
  const [max, setMax] = React.useState(query.max === null ? "" : paiseToRupees(query.max))
  const active = (query.preset !== "all" ? 1 : 0) + (query.min !== null || query.max !== null ? 1 : 0)
  const badMin = min.trim() !== "" && rupeesToPaise(min) === null
  const badMax = max.trim() !== "" && rupeesToPaise(max) === null

  const apply = () => {
    setOpen(false)
    const custom = preset === "custom"
    go({ preset: custom && !from && !to ? "all" : preset, from: custom ? from || null : null, to: custom ? to || null : null, min: rupeesToPaise(min), max: rupeesToPaise(max) })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setPreset(query.preset)
          setFrom(query.from ?? "")
          setTo(query.to ?? "")
          setMin(query.min === null ? "" : paiseToRupees(query.min))
          setMax(query.max === null ? "" : paiseToRupees(query.max))
        }
      }}
    >
      <PopoverTrigger render={<Button variant="outline" className={cn("h-8 gap-1.5 px-2.5 text-[13px] font-normal", active && "border-brand/40 bg-brand/5")} />}>
        <ListFilterIcon className="size-3.5 text-muted-foreground" /> Filter
        {active > 0 && <span className="grid size-4 place-items-center rounded-full bg-brand text-[10px] font-semibold text-white tabular-nums">{active}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!badMin && !badMax) apply()
          }}
        >
          <div className="grid gap-2 p-3">
            <p className="text-xs font-medium text-muted-foreground">Issued</p>
            <div className="grid grid-cols-3 gap-1">
              {[...ISSUED_PRESETS, "custom" as const].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={cn("h-7 rounded-md border px-2 text-xs transition-colors", preset === p ? "border-brand/50 bg-brand/8 font-medium text-foreground" : "border-transparent bg-muted/50 text-foreground/70 hover:text-foreground")}
                >
                  {p === "all" ? "Any time" : PRESET_LABEL[p]}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <DateField field="issued-from" value={from} max={to || undefined} onChange={setFrom} />
                <DateField field="issued-to" value={to} min={from || undefined} onChange={setTo} />
              </div>
            )}
          </div>
          <div className="grid gap-2 border-t p-3">
            <p className="text-xs font-medium text-muted-foreground">Amount (₹)</p>
            <div className="grid grid-cols-2 gap-2">
              <AmountInput label="Min" value={min} onChange={setMin} invalid={badMin} />
              <AmountInput label="Max" value={max} onChange={setMax} invalid={badMax} />
            </div>
            {(badMin || badMax) && <p className="text-xs text-red-600 dark:text-red-400">Use digits only, like 1500 or 1,500.50</p>}
          </div>
          <div className="flex justify-between gap-2 border-t p-2">
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setOpen(false)
                go({ preset: "all", from: null, to: null, min: null, max: null })
              }}
            >
              Reset
            </Button>
            <Button type="submit" className="h-7 px-3 text-xs" disabled={badMin || badMax}>
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function AmountInput({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid: boolean }) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className="h-8 w-full rounded-lg border bg-background pr-2 pl-10 text-right text-[13px] tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
      />
    </label>
  )
}

function ViewMenu({ hidden, setHidden, compact, setCompact, reset }: { hidden: ColId[]; setHidden: (h: ColId[]) => void; compact: boolean; setCompact: (c: boolean) => void; reset: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[13px] font-normal" />}>
        <Settings2Icon className="size-3.5 text-muted-foreground" /> <span className="hidden sm:inline">Edit view</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs">Columns</DropdownMenuLabel>
          {COLUMNS.map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              className="gap-2 py-1.5 text-[13px]"
              checked={!hidden.includes(c.id)}
              onCheckedChange={(on) => setHidden(on ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
            >
              <c.icon className="size-3.5 text-muted-foreground" />
              {c.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem className="py-1.5 text-[13px]" checked={compact} onCheckedChange={setCompact}>
          Compact rows
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem className="py-1.5 text-[13px]" onClick={reset}>
          Reset view
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------- chips -------------------------------- */

function FilterChips({ query, clients, go, total }: { query: InvoiceQuery; clients: { id: string; name: string }[]; go: (p: Partial<InvoiceQuery>) => void; total: number }) {
  const names = clients.filter((c) => query.clients.includes(c.id)).map((c) => c.name)
  const chips: { key: string; label: string; clear: Partial<InvoiceQuery> }[] = []
  if (query.q) chips.push({ key: "q", label: `Search “${query.q}”`, clear: { q: "" } })
  if (query.clients.length) chips.push({ key: "client", label: query.clients.length === 1 ? `Client: ${names[0] ?? "1 client"}` : `${query.clients.length} clients`, clear: { clients: [] } })
  if (query.preset !== "all")
    chips.push({
      key: "issued",
      label: `Issued: ${query.preset === "custom" ? `${query.from ? formatDate(query.from) : "start"} – ${query.to ? formatDate(query.to) : "today"}` : PRESET_LABEL[query.preset]}`,
      clear: { preset: "all", from: null, to: null },
    })
  if (query.min !== null || query.max !== null)
    chips.push({
      key: "amount",
      label: `Amount: ${query.min !== null ? formatMoney(query.min, { whole: true }) : "₹0"} – ${query.max !== null ? formatMoney(query.max, { whole: true }) : "any"}`,
      clear: { min: null, max: null },
    })
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-1.5 text-xs">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-6 items-center gap-1 rounded-md border border-brand/30 bg-brand/5 pr-0.5 pl-2">
          <span className="max-w-64 truncate">{c.label}</span>
          <button type="button" aria-label={`Remove filter ${c.label}`} onClick={() => go(c.clear)} className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground">
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => go({ q: "", clients: [], preset: "all", from: null, to: null, min: null, max: null })} className="px-1 text-muted-foreground hover:text-foreground hover:underline">
        Clear all
      </button>
      <span className="ml-auto text-muted-foreground tabular-nums">
        {total} match{total === 1 ? "" : "es"}
      </span>
    </div>
  )
}

/* ------------------------------- load more ------------------------------- */

function LoadMore({ shown, total, page, pending, more }: { shown: number; total: number; page: number; pending: boolean; more: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const capped = page >= MAX_PAGES
  // load the next page as the end of the table scrolls into view
  React.useEffect(() => {
    const el = ref.current
    if (!el || capped || pending) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more(), { rootMargin: "200px" })
    io.observe(el)
    return () => io.disconnect()
  }, [capped, pending, more])
  return (
    <div ref={ref} className="flex items-center justify-center gap-3 px-3 py-4 text-[13px] text-muted-foreground">
      <span className="tabular-nums">
        Showing {shown.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
      </span>
      {capped ? (
        <span>· Search or filter to narrow it down, or export them all.</span>
      ) : (
        <Button variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" disabled={pending} onClick={more}>
          {pending && <LoaderCircleIcon className="size-3 animate-spin" />} Load more
        </Button>
      )}
    </div>
  )
}

/* --------------------------------- empty --------------------------------- */

const EMPTY: Record<InvoiceView, { icon: LucideIcon; title: string; body: string; cta?: boolean }> = {
  all: { icon: FileTextIcon, title: "No invoices yet", body: "Your invoices show up here as soon as you start one. Drafts save themselves as you type.", cta: true },
  draft: { icon: FilePenLineIcon, title: "No drafts", body: "An invoice you start but don't send waits here until you're ready.", cta: true },
  sent: { icon: SendIcon, title: "Nothing awaiting payment", body: "Invoices you send land here until they're paid or fall due." },
  overdue: { icon: CircleCheckBigIcon, title: "Nothing overdue", body: "Every sent invoice is either paid or not yet due. Nice." },
  paid: { icon: CircleCheckBigIcon, title: "No paid invoices yet", body: "Record payments on a sent invoice. Once they add up to its total, it moves here." },
  upcoming: { icon: CalendarClockIcon, title: "Nothing due in the next 30 days", body: "Open invoices falling due within a month show up here, soonest first." },
  void: { icon: FileTextIcon, title: "No void invoices", body: "Invoices you cancel stay on record here, with their numbers." },
}

function Empty({ view, filtered, clear }: { view: InvoiceView; filtered: boolean; clear: () => void }) {
  const e = filtered ? { icon: SearchXIcon, title: "No invoices match", body: "Try another search, or clear the filters to see everything in this tab." } : EMPTY[view]
  const Icon = e.icon
  return (
    <div className="grid flex-1 place-items-center px-4 py-16 text-center">
      <div className="grid max-w-sm justify-items-center gap-2">
        <span className="grid size-10 place-items-center rounded-xl border bg-muted/40 text-muted-foreground">
          <Icon className="size-4.5" />
        </span>
        <h2 className="mt-1 text-[15px] font-semibold">{e.title}</h2>
        <p className="text-[13px] text-muted-foreground">{e.body}</p>
        {filtered ? (
          <Button variant="outline" className="mt-2 h-8 text-[13px]" onClick={clear}>
            Clear filters
          </Button>
        ) : (
          "cta" in e &&
          e.cta && (
            <Link href="/create" className={cn(buttonVariants(), "mt-2 h-8 gap-1.5 px-3 text-[13px]")}>
              <PlusIcon /> Create an invoice
            </Link>
          )
        )}
      </div>
    </div>
  )
}
