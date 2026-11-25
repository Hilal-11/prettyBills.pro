"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BoxIcon, LoaderCircleIcon, MoreHorizontalIcon, PencilLineIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"

import { MoneyInput, SelectField } from "@/components/invoice-editor/fields"
import { useToast } from "@/components/invoice-editor/toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { deleteItemRemote, saveItemRemote } from "@/lib/client/workspace"
import type { ItemRow } from "@/lib/data/types"
import type { CatalogItem } from "@/lib/invoice/defaults"
import { TAX_RATES, UNITS } from "@/lib/invoice/config"
import { uid } from "@/lib/invoice/format"
import { formatMoney } from "@/lib/invoice/totals"

import { F } from "./clients-manager"
import { EmptyState } from "./states"

const COLS = "minmax(0,2.4fr) 7rem 5rem 1fr 5rem 3rem"

function taxLabel(i: CatalogItem) {
  if (i.taxCategory === "exempt") return "Exempt"
  if (i.taxCategory === "nil") return "Nil"
  return `${i.taxRate}%`
}

/** /items: the goods and services you bill for, ready to drop into an invoice. */
export function ItemsManager({ items }: { items: ItemRow[] }) {
  const [q, setQ] = React.useState("")
  const [editing, setEditing] = React.useState<CatalogItem | "new" | null>(null)
  const [deleting, setDeleting] = React.useState<ItemRow | null>(null)
  const router = useRouter()
  const toast = useToast()

  const term = q.trim().toLowerCase()
  const shown = term ? items.filter((i) => [i.name, i.description, i.hsnSac].some((v) => v?.toLowerCase().includes(term))) : items

  async function remove(i: ItemRow) {
    setDeleting(null)
    try {
      await deleteItemRemote(i.id)
      toast({ title: `${i.name} removed`, tone: "success", duration: 2500 })
      router.refresh()
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" })
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"} · Add them to an invoice from <span className="font-medium text-foreground">Add from catalog</span> in the editor
        </p>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items or HSN/SAC"
              aria-label="Search items"
              className="h-8 w-full rounded-lg border bg-background pr-3 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <Button className="h-8 shrink-0 gap-1.5 px-3 text-[13px]" onClick={() => setEditing("new")}>
            <PlusIcon /> Add item
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={BoxIcon} title="No items yet" body="Save what you sell, with its HSN/SAC code, unit, rate and GST. Then add it to any invoice in one click.">
          <Button className="mt-5 h-8 gap-1.5 px-3 text-[13px]" onClick={() => setEditing("new")}>
            <PlusIcon /> Add your first item
          </Button>
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={SearchIcon} title={`No items match “${q}”`} body="Search by name, description or HSN/SAC code." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="hidden grid-cols-(--cols) gap-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid" style={{ "--cols": COLS } as React.CSSProperties}>
            <span>Item</span>
            <span>HSN / SAC</span>
            <span>Unit</span>
            <span className="text-right">Rate</span>
            <span className="text-right">GST</span>
            <span />
          </div>
          <ul className="divide-y">
            {shown.map((i) => (
              <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-[13px] md:grid-cols-(--cols)" style={{ "--cols": COLS } as React.CSSProperties}>
                <button type="button" onClick={() => setEditing(i)} className="min-w-0 text-left outline-none focus-visible:underline">
                  <span className="block truncate font-semibold">{i.name}</span>
                  <span className="block truncate text-muted-foreground">{i.description || <span className="md:hidden">{[i.hsnSac, i.unit].filter(Boolean).join(" · ")}</span>}</span>
                </button>
                <span className="hidden font-mono text-[12px] text-foreground/85 md:block">{i.hsnSac || "—"}</span>
                <span className="hidden text-foreground/85 md:block">{i.unit}</span>
                <span className="text-right font-medium tabular-nums">
                  {formatMoney(i.rate)}
                  <span className="text-xs font-normal text-muted-foreground md:hidden"> /{i.unit}</span>
                </span>
                <span className="hidden text-right tabular-nums md:block">{taxLabel(i)}</span>
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${i.name}`} className="text-foreground/70" />}>
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-40 rounded-xl p-1.5">
                      <DropdownMenuItem className="gap-2 py-1.5 text-[13px]" onClick={() => setEditing(i)}>
                        <PencilLineIcon /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" className="gap-2 py-1.5 text-[13px]" onClick={() => setDeleting(i)}>
                        <Trash2Icon /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-[480px]">
          {editing !== null && (
            <ItemForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? null : editing}
              onCancel={() => setEditing(null)}
              onSaved={(item, isNew) => {
                setEditing(null)
                toast({ title: isNew ? `${item.name} added` : `${item.name} updated`, tone: "success", duration: 2500 })
                router.refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>It won&apos;t be offered in the editor any more. Invoices that already use it don&apos;t change.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" className="h-8 text-[13px]" onClick={() => deleting && remove(deleting)}>
              Remove item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const ctl = "h-9 bg-background text-[13px] md:text-[13px]"
const unitOptions = UNITS.map((u) => ({ value: u, label: u }))

function ItemForm({ initial, onSaved, onCancel }: { initial: CatalogItem | null; onSaved: (i: CatalogItem, isNew: boolean) => void; onCancel: () => void }) {
  const [i, setI] = React.useState<CatalogItem>(() => initial ?? { id: "", name: "", description: "", hsnSac: "", unit: "pcs", rate: 0, taxRate: 18, taxCategory: "taxable" })
  const [tried, setTried] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const isNew = !initial
  const set = (patch: Partial<CatalogItem>) => setI((x) => ({ ...x, ...patch }))

  const errors: Record<string, string> = {}
  if (!i.name.trim()) errors.name = "Enter a name"
  if (i.hsnSac && !/^\d{4,8}$/.test(i.hsnSac)) errors.hsn = "4 to 8 digits"
  const show = (k: string) => (tried ? errors[k] : undefined)
  const taxValue = i.taxCategory === "exempt" ? "exempt" : i.taxCategory === "nil" ? "nil" : String(i.taxRate)
  const units = unitOptions.some((u) => u.value === i.unit) ? unitOptions : [...unitOptions, { value: i.unit, label: i.unit }]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) return
    setPending(true)
    setError(null)
    const saved: CatalogItem = { ...i, id: i.id || uid("cat"), name: i.name.trim() }
    try {
      await saveItemRemote(saved)
      onSaved(saved, isNew)
    } catch (err) {
      setError((err as Error).message)
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="border-b px-5 py-4">
        <DialogTitle className="text-[15px] font-semibold">{isNew ? "Add an item" : `Edit ${initial?.name}`}</DialogTitle>
        <DialogDescription className="mt-0.5 text-xs text-muted-foreground">A product or service you bill for. Names are unique: saving one with an existing name replaces it.</DialogDescription>
      </div>
      <div className="grid grid-cols-2 gap-3 px-5 py-4">
        <F label="Name" required error={show("name")} className="col-span-2">
          <Input autoFocus value={i.name} maxLength={200} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!show("name") || undefined} className={ctl} />
        </F>
        <F label="Description" className="col-span-2">
          <Input placeholder="Optional, printed under the name" value={i.description ?? ""} maxLength={1000} onChange={(e) => set({ description: e.target.value })} className={ctl} />
        </F>
        <F label="HSN / SAC" error={show("hsn")} hint="HSN for goods, SAC for services">
          <Input inputMode="numeric" maxLength={8} value={i.hsnSac ?? ""} onChange={(e) => set({ hsnSac: e.target.value.replace(/\D/g, "") })} aria-invalid={!!show("hsn") || undefined} className={cn(ctl, "font-mono")} />
        </F>
        <F label="Unit">
          <SelectField field="item.unit" value={i.unit} options={units} onChange={(v) => set({ unit: v })} />
        </F>
        <F label="Rate" hint="Before GST">
          <MoneyInput field="item.rate" value={i.rate} onChange={(paise) => set({ rate: paise })} />
        </F>
        <F label="GST">
          <SelectField
            field="item.tax"
            value={taxValue}
            options={TAX_RATES.map((t) => ({ value: t.value, label: t.label }))}
            onChange={(v) => {
              const t = TAX_RATES.find((x) => x.value === v)
              if (t) set({ taxRate: t.rate, taxCategory: t.category })
            }}
          />
        </F>
      </div>
      {error && <p className="mx-5 mb-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
        <Button type="button" variant="ghost" className="h-8 text-[13px]" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="h-8 min-w-24 text-[13px]" disabled={pending}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : isNew ? "Add item" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}
