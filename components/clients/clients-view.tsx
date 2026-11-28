"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CircleAlertIcon,
  CircleCheckBigIcon,
  CopyIcon,
  DownloadIcon,
  FilePlus2Icon,
  FileTextIcon,
  HashIcon,
  IndianRupeeIcon,
  LoaderCircleIcon,
  MailIcon,
  MapPinIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  PhoneIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
  SearchXIcon,
  Settings2Icon,
  Trash2Icon,
  UsersIcon,
  WalletIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { ClientDialog } from "@/components/app/clients-manager"
import { useToast } from "@/components/invoice-editor/toast"
import { ClientChip } from "@/components/invoices/client-chip"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BOM, csvAmount, csvRow } from "@/lib/billing/csv"
import { formatDate } from "@/lib/billing/dates"
import { useStored } from "@/lib/client/use-stored"
import { deleteClientRemote } from "@/lib/client/workspace"
import type { ClientWithStats } from "@/lib/data/types"
import type { Client } from "@/lib/invoice/defaults"
import { stateLabel } from "@/lib/invoice/config"
import { formatMoney } from "@/lib/invoice/totals"
import { spring } from "@/lib/motion"

const money = (p: number) => formatMoney(p, { whole: true })
const Muted = ({ children = "—" }: { children?: React.ReactNode }) => <span className="text-muted-foreground/70">{children}</span>
const where = (c: Client) => [c.address.city, c.address.stateCode && stateLabel(c.address.stateCode)].filter(Boolean).join(", ")

type View = "all" | "owes" | "overdue" | "new"
const TABS: { view: View; label: string; hint: string; danger?: boolean }[] = [
  { view: "all", label: "All", hint: "Everyone you bill" },
  { view: "owes", label: "Owes you", hint: "Clients with money still owed" },
  { view: "overdue", label: "Overdue", hint: "Clients with an invoice past due", danger: true },
  { view: "new", label: "No invoices yet", hint: "Saved, but not billed yet" },
]
const inView = (c: ClientWithStats, v: View) => (v === "owes" ? c.outstanding > 0 : v === "overdue" ? c.overdue > 0 : v === "new" ? c.invoices === 0 : true)

type ColId = "gstin" | "location" | "email" | "phone" | "invoices" | "billed" | "received" | "tds" | "outstanding" | "overdue" | "last"
type Col = { id: ColId; label: string; icon: LucideIcon; width: number; right?: boolean; total?: boolean; sort: (c: ClientWithStats) => string | number; cell: (c: ClientWithStats) => React.ReactNode }

const COLUMNS: Col[] = [
  { id: "gstin", label: "GSTIN", icon: HashIcon, width: 144, sort: (c) => c.gstin ?? "", cell: (c) => (c.gstin ? <span className="font-mono text-[12px] tracking-tight">{c.gstin}</span> : <Muted>Unregistered</Muted>) },
  { id: "location", label: "Location", icon: MapPinIcon, width: 150, sort: (c) => where(c), cell: (c) => where(c) || <Muted /> },
  { id: "email", label: "Email", icon: MailIcon, width: 200, sort: (c) => c.email ?? "", cell: (c) => c.email || <Muted /> },
  { id: "phone", label: "Phone", icon: PhoneIcon, width: 130, sort: (c) => c.phone ?? "", cell: (c) => c.phone || <Muted /> },
  { id: "invoices", label: "Invoices", icon: FileTextIcon, width: 96, right: true, total: true, sort: (c) => c.invoices, cell: (c) => c.invoices || <Muted /> },
  { id: "billed", label: "Billed", icon: IndianRupeeIcon, width: 116, right: true, total: true, sort: (c) => c.billed, cell: (c) => (c.billed ? <span className="font-medium">{money(c.billed)}</span> : <Muted />) },
  { id: "received", label: "Received", icon: CircleCheckBigIcon, width: 124, right: true, total: true, sort: (c) => c.received, cell: (c) => (c.received ? money(c.received) : <Muted />) },
  { id: "tds", label: "TDS", icon: ReceiptTextIcon, width: 108, right: true, total: true, sort: (c) => c.tds, cell: (c) => (c.tds ? money(c.tds) : <Muted />) },
  { id: "outstanding", label: "Owes you", icon: WalletIcon, width: 116, right: true, total: true, sort: (c) => c.outstanding, cell: (c) => (c.outstanding ? <span className="font-medium">{money(c.outstanding)}</span> : <Muted />) },
  { id: "overdue", label: "Overdue", icon: CircleAlertIcon, width: 108, right: true, total: true, sort: (c) => c.overdue, cell: (c) => (c.overdue ? <span className="font-medium text-red-600 dark:text-red-400">{money(c.overdue)}</span> : <Muted />) },
  { id: "last", label: "Last invoice", icon: CalendarIcon, width: 120, sort: (c) => c.lastInvoiceDate ?? "", cell: (c) => (c.lastInvoiceDate ? formatDate(c.lastInvoiceDate) : <Muted>Never</Muted>) },
]
const DEFAULT_HIDDEN: ColId[] = ["email", "phone", "received", "tds"]
const NO_FLAGS = { compact: false }

type Sort = { by: ColId | "name"; dir: "asc" | "desc" }

const th = "h-9 border-r border-b border-border/70 bg-background px-3 text-left text-xs font-normal whitespace-nowrap text-muted-foreground"
const td = "h-10 overflow-hidden border-r border-b border-border/50 bg-(--row) px-3 text-ellipsis whitespace-nowrap transition-colors"
const tf = "h-9 border-t border-r border-border/70 bg-background px-3 text-xs"

/**
 * /clients as a full-width table, like invoices: tabs, search, sortable
 * columns you can show or hide, totals, multi-select with export and
 * remove, and every client action from the row menu. The list is small
 * enough to sort and filter in the browser, so it's instant.
 */
export function ClientsView({ clients, openNew, stats }: { clients: ClientWithStats[]; openNew?: boolean; stats?: React.ReactNode }) {
  const router = useRouter()
  const toast = useToast()
  const [view, setView] = React.useState<View>("all")
  const [q, setQ] = React.useState("")
  const [sort, setSort] = React.useState<Sort>({ by: "name", dir: "asc" })
  const [hidden, setHidden] = useStored<ColId[]>("pb.clients.hidden", DEFAULT_HIDDEN)
  const [flags, setFlags] = useStored("pb.clients.flags", NO_FLAGS)
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set())
  const [editing, setEditing] = React.useState<Client | "new" | null>(openNew ? "new" : null)
  const [removing, setRemoving] = React.useState<ClientWithStats[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const search = React.useRef<HTMLInputElement>(null)
  const last = React.useRef<number | null>(null)
  const shift = React.useRef(false)

  const cols = COLUMNS.filter((c) => !hidden.includes(c.id))
  const term = q.trim().toLowerCase()
  const rows = React.useMemo(() => {
    const matched = clients.filter((c) => inView(c, view) && (!term || [c.name, c.gstin, c.email, c.phone, c.address.city, c.legalName].some((v) => v?.toLowerCase().includes(term))))
    const key = sort.by === "name" ? (c: ClientWithStats) => c.name.toLowerCase() : COLUMNS.find((x) => x.id === sort.by)!.sort
    const dir = sort.dir === "asc" ? 1 : -1
    return [...matched].sort((a, b) => {
      const x = key(a)
      const y = key(b)
      // blanks last either way
      if (x === "" && y !== "") return 1
      if (y === "" && x !== "") return -1
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir || a.name.localeCompare(b.name)
    })
  }, [clients, view, term, sort])
  const ids = React.useMemo(() => new Set(rows.map((r) => r.id)), [rows])
  const chosen = rows.filter((r) => picked.has(r.id))
  const scope = chosen.length ? chosen : rows
  const allPicked = rows.length > 0 && chosen.length === rows.length
  const counts = Object.fromEntries(TABS.map((t) => [t.view, clients.filter((c) => inView(c, t.view)).length])) as Record<View, number>

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")
      if (e.key === "/" && !typing) {
        e.preventDefault()
        search.current?.focus()
      }
      if (e.key === "Escape" && !typing && !document.querySelector("[role=dialog],[role=menu]")) setPicked(new Set())
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const toggle = (index: number, on: boolean) => {
    setPicked((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)))
      const from = shift.current && last.current !== null ? Math.min(last.current, index) : index
      const to = shift.current && last.current !== null ? Math.max(last.current, index) : index
      for (let k = from; k <= to; k++) {
        if (on) next.add(rows[k].id)
        else next.delete(rows[k].id)
      }
      return next
    })
    last.current = index
  }

  const sortBy = (by: Sort["by"], numeric: boolean) => setSort((s) => (s.by === by ? { by, dir: s.dir === "asc" ? "desc" : "asc" } : { by, dir: numeric ? "desc" : "asc" }))

  const exportCsv = (list: ClientWithStats[]) => {
    const head = ["Name", "Legal name", "GSTIN", "PAN", "Email", "Phone", "Address", "City", "PIN", "State", "Country", "Invoices", "Billed (INR)", "Received (INR)", "TDS (INR)", "Owes you (INR)", "Overdue (INR)", "Last invoice"]
    const body = list
      .map((c) =>
        csvRow([c.name, c.legalName, c.gstin, c.pan, c.email, c.phone, [c.address.line1, c.address.line2].filter(Boolean).join(", "), c.address.city, c.address.pin, c.address.stateCode ? stateLabel(c.address.stateCode) : "", c.address.country, c.invoices, csvAmount(c.billed), csvAmount(c.received), csvAmount(c.tds), csvAmount(c.outstanding), csvAmount(c.overdue), c.lastInvoiceDate ?? ""])
      )
      .join("")
    const url = URL.createObjectURL(new Blob([BOM + csvRow(head) + body], { type: "text/csv;charset=utf-8" }))
    const a = Object.assign(document.createElement("a"), { href: url, download: `prettybill-clients${list.length < clients.length ? "-selected" : ""}.csv` })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const remove = async (list: ClientWithStats[]) => {
    setRemoving(null)
    setBusy(true)
    let done = 0
    let failed: string | null = null
    for (const c of list) {
      try {
        await deleteClientRemote(c.id)
        done++
      } catch (e) {
        failed = (e as Error).message
      }
    }
    setBusy(false)
    setPicked(new Set())
    if (failed && !done) return toast({ title: failed, tone: "error" })
    toast({ title: done === 1 ? `${list[0].name} removed` : `${done} clients removed`, description: failed ? `Some couldn't be removed: ${failed}` : "Their invoices keep their details.", tone: failed ? "error" : "success", duration: 3000 })
    router.refresh()
  }

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text).catch(() => {})
    toast({ title: `${what} copied`, description: text, tone: "success", duration: 2000 })
  }

  const minWidth = 40 + 40 + 200 + cols.reduce((s, c) => s + c.width, 0) + 44
  const totals = (id: ColId) => scope.reduce((s, c) => s + Number(COLUMNS.find((x) => x.id === id)!.sort(c)), 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
        <nav aria-label="Client views" className="-mx-1 max-w-full overflow-x-auto px-1">
          <ul className="flex items-center gap-0.5">
            {TABS.map((t) => {
              const on = view === t.view
              return (
                <li key={t.view}>
                  <button
                    type="button"
                    aria-pressed={on}
                    title={t.hint}
                    onClick={() => setView(t.view)}
                    className={cn("relative isolate inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors", on ? "font-medium text-foreground" : "text-foreground/60 hover:text-foreground")}
                  >
                    {on && <motion.span layoutId="client-tabs" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-muted/70" />}
                    {t.label}
                    <span className={cn("text-xs tabular-nums", t.danger && counts[t.view] > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{counts[t.view]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="relative w-full sm:w-56">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={search}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients"
              aria-label="Search clients by name, GSTIN, email, phone or city"
              className="h-8 w-full rounded-lg border bg-background pr-8 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[13px] font-normal" />}>
              <Settings2Icon className="size-3.5 text-muted-foreground" /> <span className="hidden sm:inline">Edit view</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-1.5">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs">Columns</DropdownMenuLabel>
                {COLUMNS.map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} className="gap-2 py-1.5 text-[13px]" checked={!hidden.includes(c.id)} onCheckedChange={(on) => setHidden(on ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}>
                    <c.icon className="size-3.5 text-muted-foreground" />
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem className="py-1.5 text-[13px]" checked={flags.compact} onCheckedChange={(compact) => setFlags({ ...flags, compact })}>
                Compact rows
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem
                className="py-1.5 text-[13px]"
                onClick={() => {
                  setHidden(DEFAULT_HIDDEN)
                  setFlags(NO_FLAGS)
                }}
              >
                Reset view
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[13px] font-normal" onClick={() => exportCsv(rows)} disabled={!rows.length} title="Download these clients as CSV">
            <DownloadIcon className="text-muted-foreground" /> <span className="hidden sm:inline">Export</span>
          </Button>
          <Button className="h-8 gap-1.5 px-3 text-[13px]" onClick={() => setEditing("new")}>
            <PlusIcon /> <span className="hidden sm:inline">Add client</span>
          </Button>
        </div>
      </div>

      {stats}

      {clients.length === 0 ? (
        <Empty icon={UsersIcon} title="No clients yet" body="Save the people and businesses you bill. Their name, GSTIN and address then fill in with one click.">
          <Button className="mt-2 h-8 gap-1.5 px-3 text-[13px]" onClick={() => setEditing("new")}>
            <PlusIcon /> Add your first client
          </Button>
        </Empty>
      ) : rows.length === 0 ? (
        <Empty icon={SearchXIcon} title={term ? `No clients match “${q}”` : "No clients here"} body={term ? "Search by name, GSTIN, email, phone or city." : "Nobody fits this tab right now."}>
          <Button
            variant="outline"
            className="mt-2 h-8 text-[13px]"
            onClick={() => {
              setQ("")
              setView("all")
            }}
          >
            Show all clients
          </Button>
        </Empty>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]" style={{ minWidth }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 40 }} />
              <col style={{ width: 200 }} />
              {cols.map((c) => (
                <col key={c.id} style={{ width: c.width }} />
              ))}
              <col style={{ width: 44 }} />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr>
                <th scope="col" className={cn(th, "sticky left-0 z-10 px-0")}>
                  <span className="grid place-items-center">
                    <Checkbox aria-label={allPicked ? "Unselect all" : "Select all shown"} checked={allPicked} indeterminate={chosen.length > 0 && !allPicked} onCheckedChange={(on) => setPicked(on ? new Set(rows.map((r) => r.id)) : new Set())} />
                  </span>
                </th>
                <th scope="col" className={cn(th, "sticky left-10 z-10 px-0")}>
                  <span className="sr-only">Row</span>
                </th>
                <SortHeader label="Client" icon={UsersIcon} on={sort.by === "name"} dir={sort.dir} onClick={() => sortBy("name", false)} className="sticky left-20 z-10" />
                {cols.map((c) => (
                  <SortHeader key={c.id} label={c.label} icon={c.icon} right={c.right} on={sort.by === c.id} dir={sort.dir} onClick={() => sortBy(c.id, !!c.right)} />
                ))}
                <th scope="col" className={cn(th, "sticky right-0 z-10 border-r-0")}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, index) => {
                const on = picked.has(c.id)
                return (
                  <tr
                    key={c.id}
                    data-selected={on || undefined}
                    onClick={(e) => {
                      const t = e.target as HTMLElement
                      if (!e.currentTarget.contains(t) || t.closest("a, button, input, [role=checkbox], [data-row-skip]") || window.getSelection()?.toString()) return
                      router.push(`/clients/${encodeURIComponent(c.id)}`)
                    }}
                    className="group/row cursor-pointer [--row:var(--background)] hover:[--row:color-mix(in_oklab,var(--muted)_70%,var(--background))] data-selected:[--row:color-mix(in_oklab,var(--brand)_7%,var(--background))]"
                  >
                    <td className={cn(td, "sticky left-0 z-[1] px-0", flags.compact && "h-8")} onClickCapture={(e) => (shift.current = e.shiftKey)} onMouseDown={(e) => e.shiftKey && e.preventDefault()}>
                      <span className="grid place-items-center">
                        <Checkbox aria-label={`Select ${c.name}`} checked={on} onCheckedChange={(v) => toggle(index, v)} />
                      </span>
                    </td>
                    <td className={cn(td, "sticky left-10 z-[1] px-0 text-center text-xs text-muted-foreground tabular-nums")}>{index + 1}</td>
                    <td className={cn(td, "sticky left-20 z-[1]")}>
                      <Link href={`/clients/${encodeURIComponent(c.id)}`} className="flex min-w-0 items-center gap-2 font-medium outline-none hover:underline focus-visible:underline">
                        <ClientChip name={c.name} />
                        <span className="truncate">{c.name}</span>
                      </Link>
                    </td>
                    {cols.map((col) => (
                      <td key={col.id} className={cn(td, col.right && "text-right tabular-nums")}>
                        {col.cell(c)}
                      </td>
                    ))}
                    <td className={cn(td, "sticky right-0 z-[1] border-r-0 px-1 text-right")} data-row-skip>
                      <RowMenu client={c} onEdit={() => setEditing(c)} onRemove={() => setRemoving([c])} onCopy={copy} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td colSpan={2} className={cn(tf, "sticky left-0 z-10 px-2 text-[11px] text-muted-foreground")} />
                <td className={cn(tf, "sticky left-20 z-10 text-muted-foreground")}>
                  {chosen.length ? `${chosen.length} selected` : `${rows.length} client${rows.length === 1 ? "" : "s"}`}
                </td>
                {cols.map((c) => (
                  <td key={c.id} className={cn(tf, "text-right tabular-nums")}>
                    {c.total && (
                      <span>
                        <span className="text-muted-foreground">{c.id === "invoices" ? "" : "Σ "}</span>
                        <span className="font-medium">{c.id === "invoices" ? totals(c.id) : money(totals(c.id))}</span>
                      </span>
                    )}
                  </td>
                ))}
                <td className={cn(tf, "sticky right-0 z-10 border-r-0")} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <AnimatePresence>
        {chosen.length > 0 && (
          <motion.div
            role="toolbar"
            aria-label="Selected clients"
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 12, x: "-50%" }}
            transition={spring}
            className="fixed bottom-16 left-1/2 z-40 flex items-center gap-1 rounded-xl border bg-popover p-1.5 text-[13px] text-popover-foreground shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]"
          >
            <span className="px-2 font-medium tabular-nums">{chosen.length} selected</span>
            <span className="h-4 w-px bg-border" />
            <Button variant="ghost" className="h-8 gap-1.5 px-2.5 text-[13px]" onClick={() => exportCsv(chosen)}>
              <DownloadIcon /> Export
            </Button>
            <Button variant="ghost" className="h-8 gap-1.5 px-2.5 text-[13px] text-red-600 hover:text-red-600 dark:text-red-400" disabled={busy} onClick={() => setRemoving(chosen)}>
              {busy ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />} Remove
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => setPicked(new Set())}>
              <XIcon />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <ClientDialog
        client={editing}
        onClose={() => {
          setEditing(null)
          if (openNew) router.replace("/clients", { scroll: false })
        }}
        onSaved={(c, isNew) => {
          setEditing(null)
          toast({ title: isNew ? `${c.name} added` : `${c.name} updated`, tone: "success", duration: 2500 })
          router.refresh()
        }}
      />

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{removing?.length === 1 ? `Remove ${removing[0].name}?` : `Remove ${removing?.length} clients?`}</AlertDialogTitle>
            <AlertDialogDescription>
              They won&apos;t be in your client list any more. Invoices already made keep the details they were sent with, so nothing on them changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" className="h-8 text-[13px]" onClick={() => removing && remove(removing)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SortHeader({ label, icon: Icon, right, on, dir, onClick, className }: { label: string; icon: LucideIcon; right?: boolean; on: boolean; dir: "asc" | "desc"; onClick: () => void; className?: string }) {
  const Arrow = dir === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <th scope="col" aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : undefined} className={cn(th, className)}>
      <button type="button" onClick={onClick} title={`Sort by ${label.toLowerCase()}`} className={cn("-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1.5 rounded px-1 py-1 transition-colors hover:text-foreground", right && "flex-row-reverse", on && "text-foreground")}>
        <Icon className="size-3.5 shrink-0 opacity-80" />
        <span className="truncate">{label}</span>
        {on && <Arrow className="size-3 shrink-0" />}
      </button>
    </th>
  )
}

const item = "gap-2 py-1.5 text-[13px]"

function RowMenu({ client: c, onEdit, onRemove, onCopy }: { client: ClientWithStats; onEdit: () => void; onRemove: () => void; onCopy: (text: string, what: string) => void }) {
  const digits = (c.phone ?? "").replace(/\D/g, "")
  const wa = digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : null
  const page = `/clients/${encodeURIComponent(c.id)}`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`} className="text-foreground/70" />}>
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuItem className={item} render={<Link href={`/create?client=${encodeURIComponent(c.id)}`} />}>
            <FilePlus2Icon /> New invoice
          </DropdownMenuItem>
          <DropdownMenuItem className={item} onClick={onEdit}>
            <PencilLineIcon /> Edit details
          </DropdownMenuItem>
          <DropdownMenuItem className={item} render={<Link href={page} />}>
            <WalletIcon /> Balance and payments
          </DropdownMenuItem>
          <DropdownMenuItem className={item} render={<Link href={`${page}?tab=statement`} />}>
            <ReceiptTextIcon /> Statement
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {(c.gstin || c.email || wa) && <DropdownMenuSeparator />}
        {c.gstin && (
          <DropdownMenuItem className={item} onClick={() => onCopy(c.gstin!, "GSTIN")}>
            <CopyIcon /> Copy GSTIN
          </DropdownMenuItem>
        )}
        {c.email && (
          <DropdownMenuItem className={item} render={<a href={`mailto:${c.email}`} />}>
            <MailIcon /> Email {c.email.length > 22 ? "" : c.email}
          </DropdownMenuItem>
        )}
        {wa && (
          <DropdownMenuItem className={item} render={<a href={wa} target="_blank" rel="noopener" />}>
            <FaWhatsapp /> WhatsApp
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className={item} onClick={onRemove}>
          <Trash2Icon /> Remove client
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Empty({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center px-4 py-16 text-center">
      <div className="grid max-w-sm justify-items-center gap-2">
        <span className="grid size-10 place-items-center rounded-xl border bg-muted/40 text-muted-foreground">
          <Icon className="size-4.5" />
        </span>
        <h2 className="mt-1 text-[15px] font-semibold">{title}</h2>
        <p className="text-[13px] text-muted-foreground">{body}</p>
        {children}
      </div>
    </div>
  )
}
