"use client"

import * as React from "react"
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AnimatePresence, motion } from "motion/react"
import { BookmarkPlusIcon, Columns3Icon, CopyIcon, EllipsisIcon, GripVerticalIcon, ListOrderedIcon, PackageIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
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
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_TAX_RATE, TAX_RATES, UNITS } from "@/lib/invoice/config"
import { uid } from "@/lib/invoice/format"
import { formatMoney } from "@/lib/invoice/totals"
import type { LineItem } from "@/lib/invoice/types"
import { ease } from "@/lib/motion"

import { Field, MoneyInput, NumberInput, Segmented, SelectField, TextField } from "../fields"
import { SectionCard } from "../section-card"
import { useToast } from "../toast"
import type { EditorApi } from "../use-editor"

/** Common SAC/HSN codes offered as suggestions in the HSN/SAC field. */
const COMMON_CODES = [
  { code: "998391", label: "Specialty design services" },
  { code: "998314", label: "IT design and development" },
  { code: "998313", label: "IT consulting and support" },
  { code: "998383", label: "Photography services" },
  { code: "998361", label: "Advertising services" },
  { code: "998311", label: "Management consulting" },
  { code: "996331", label: "Restaurant and food services" },
  { code: "995411", label: "Construction of buildings" },
  { code: "999311", label: "Hospital services" },
  { code: "4901", label: "Printed books" },
  { code: "6109", label: "T-shirts, knitted" },
]

const taxOptions = [...TAX_RATES.map((t) => ({ value: t.value, label: t.label })), { value: "custom", label: "Custom…" }]

function taxValue(it: LineItem) {
  if (it.taxCategory === "exempt") return "exempt"
  if (it.taxCategory === "nil") return "nil"
  return TAX_RATES.some((t) => t.category === "taxable" && t.rate === it.taxRate) ? String(it.taxRate) : "custom"
}

export function ItemsSection({ ed }: { ed: EditorApi }) {
  const inv = ed.invoice
  const toast = useToast()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const focusItem = (id: string) =>
    requestAnimationFrame(() => setTimeout(() => document.querySelector<HTMLElement>(`[data-field="items.${id}.name"]`)?.focus(), 60))

  const addItem = (seed?: Partial<LineItem>) => {
    const id = uid("li")
    ed.update((d) => {
      d.items.push({ id, name: "", qty: 1, unit: "pcs", rate: 0, taxRate: DEFAULT_TAX_RATE, hsnSac: "", ...seed })
    })
    if (!seed?.name) focusItem(id)
    return id
  }

  const removeItem = (id: string) => {
    const index = inv.items.findIndex((i) => i.id === id)
    const removed = inv.items[index]
    ed.update((d) => {
      d.items = d.items.filter((i) => i.id !== id)
    })
    toast({
      title: `Removed ${removed?.name || "item"}`,
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () =>
          ed.update((d) => {
            d.items.splice(Math.min(index, d.items.length), 0, removed)
          }),
      },
    })
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    ed.update((d) => {
      const from = d.items.findIndex((i) => i.id === e.active.id)
      const to = d.items.findIndex((i) => i.id === e.over!.id)
      d.items = arrayMove(d.items, from, to)
    })
  }

  return (
    <SectionCard
      ed={ed}
      id="items"
      icon={ListOrderedIcon}
      title="Items"
      summary={`${inv.items.length} line${inv.items.length === 1 ? "" : "s"} · ${formatMoney(ed.totals.subtotal)}`}
      action={
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-foreground/65 tabular-nums">
            {inv.items.length} line{inv.items.length === 1 ? "" : "s"}
          </span>
          <ColumnsMenu ed={ed} />
        </div>
      }
    >
      <datalist id="pb-catalog">
        {ed.catalog.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <datalist id="pb-codes">
        {COMMON_CODES.map((c) => (
          <option key={c.code} value={c.code} label={c.label} />
        ))}
      </datalist>

      {ed.errorFor("items") && <p className="text-xs text-destructive">{ed.errorFor("items")}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={inv.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {inv.items.map((item, i) => (
                <ItemRow
                  key={item.id}
                  ed={ed}
                  item={item}
                  index={i}
                  isLast={i === inv.items.length - 1}
                  onRemove={() => removeItem(item.id)}
                  onEnterLast={() => addItem()}
                  onDuplicate={() => {
                    const id = uid("li")
                    ed.update((d) => {
                      d.items.splice(i + 1, 0, { ...structuredClone(item), id })
                    })
                  }}
                  onSaveToCatalog={() => {
                    ed.saveCatalogItem({ id: uid("cat"), name: item.name, description: item.description, hsnSac: item.hsnSac, unit: item.unit, rate: item.rate, taxRate: item.taxRate, taxCategory: item.taxCategory })
                    toast({ title: `Saved "${item.name}" to your catalog`, tone: "success" })
                  }}
                />
              ))}
            </AnimatePresence>
          </ul>
        </SortableContext>
      </DndContext>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button variant="outline" onClick={() => addItem()} className="h-9 border-dashed text-[13px] text-foreground/80 hover:text-foreground">
          <PlusIcon /> Add item
        </Button>
        <CatalogPicker ed={ed} onAdd={(items) => items.forEach((c) => addItem({ catalogItemId: c.id, name: c.name, description: c.description, hsnSac: c.hsnSac, unit: c.unit, rate: c.rate, taxRate: c.taxRate, taxCategory: c.taxCategory }))} />
      </div>
    </SectionCard>
  )
}

function ItemRow({
  ed,
  item,
  index,
  isLast,
  onRemove,
  onEnterLast,
  onDuplicate,
  onSaveToCatalog,
}: {
  ed: EditorApi
  item: LineItem
  index: number
  isLast: boolean
  onRemove: () => void
  onEnterLast: () => void
  onDuplicate: () => void
  onSaveToCatalog: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [showDesc, setShowDesc] = React.useState(!!item.description)
  const [showDiscount, setShowDiscount] = React.useState(!!item.discount)
  const p = `items.${item.id}`
  const set = (key: string, recipe: (it: LineItem) => void) =>
    ed.update((d) => {
      const it = d.items.find((x) => x.id === item.id)
      if (it) recipe(it)
    }, `${p}.${key}`)
  const err = (k: string) => ed.errorFor(`${p}.${k}`)
  const amount = ed.totals.lines[index]?.base ?? 0
  const tv = taxValue(item)

  return (
    <motion.li
      ref={setNodeRef}
      layout="position"
      initial={{ opacity: 0, y: -6, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, height: 0, filter: "blur(4px)" }}
      transition={{ duration: 0.25, ease }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/item rounded-lg border bg-background/70 p-2.5", isDragging && "z-10 shadow-lg ring-2 ring-brand/40")}
      onFocusCapture={() => ed.setHighlight("items")}
    >
      <div className="flex items-start gap-1.5">
        <button type="button" aria-label={`Reorder ${item.name || "item"}`} className="mt-2 cursor-grab touch-none rounded p-0.5 text-foreground/40 hover:text-foreground active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVerticalIcon className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <TextField
            field={`${p}.name`}
            list="pb-catalog"
            placeholder="Item or service"
            aria-label="Item"
            value={item.name}
            error={err("name")}
            onBlur={() => ed.touch(`${p}.name`)}
            onChange={(v) =>
              set("name", (it) => {
                it.name = v
                const hit = ed.catalog.find((c) => c.name.toLowerCase() === v.toLowerCase())
                if (hit) {
                  it.catalogItemId = hit.id
                  it.hsnSac = hit.hsnSac
                  it.unit = hit.unit
                  it.rate = hit.rate
                  it.taxRate = hit.taxRate
                  it.taxCategory = hit.taxCategory
                  if (hit.description && !it.description) it.description = hit.description
                }
              })
            }
          />
          {err("name") && <p className="mt-1 text-xs text-destructive">{err("name")}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Item actions" className="mt-0.5 text-foreground/60" />}>
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={onDuplicate}>
              <CopyIcon /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSaveToCatalog} disabled={!item.name.trim()}>
              <BookmarkPlusIcon /> Save to catalog
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 grid grid-cols-[0.8fr_0.9fr_1.4fr_1fr] gap-2 pl-6">
        <Field label="Qty" required error={err("qty")}>
          <NumberInput field={`${p}.qty`} decimals={3} value={item.qty} error={err("qty")} aria-label="Quantity" onBlur={() => ed.touch(`${p}.qty`)} onChange={(n) => set("qty", (it) => void (it.qty = n))} />
        </Field>
        <Field label="Unit">
          <SelectField field={`${p}.unit`} value={item.unit} options={UNITS.map((u) => ({ value: u, label: u }))} onChange={(v) => set("unit", (it) => void (it.unit = v))} />
        </Field>
        <Field label="Rate" required error={err("rate")}>
          <MoneyInput
            field={`${p}.rate`}
            value={item.rate}
            aria-label="Rate in rupees"
            error={err("rate")}
            onChange={(paise) => set("rate", (it) => void (it.rate = paise))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isLast) {
                e.preventDefault()
                onEnterLast()
              }
            }}
          />
        </Field>
        <Field label="Tax">
          <SelectField
            field={`${p}.tax`}
            value={tv}
            options={taxOptions}
            onChange={(v) =>
              set("tax", (it) => {
                const opt = TAX_RATES.find((t) => t.value === v)
                if (v === "custom") {
                  it.taxCategory = "taxable"
                  if (TAX_RATES.some((t) => t.rate === it.taxRate)) it.taxRate = 12
                } else if (opt) {
                  it.taxRate = opt.rate
                  it.taxCategory = opt.category
                }
              })
            }
          />
        </Field>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2 pl-6">
        <div className="grid grid-cols-2 gap-2">
          <Field label="HSN / SAC" error={err("hsnSac")}>
            <TextField field={`${p}.hsnSac`} list="pb-codes" inputMode="numeric" maxLength={8} value={item.hsnSac} error={err("hsnSac")} onBlur={() => ed.touch(`${p}.hsnSac`)} onChange={(v) => set("hsnSac", (it) => void (it.hsnSac = v.replace(/\D/g, "")))} />
          </Field>
          {tv === "custom" && (
            <Field label="Custom rate">
              <NumberInput field={`${p}.customRate`} decimals={2} suffix="%" value={item.taxRate} onChange={(n) => set("taxRate", (it) => void (it.taxRate = Math.min(100, n)))} />
            </Field>
          )}
        </div>
        <div className="pb-2 text-right">
          <p className="text-xs text-foreground/65">Amount</p>
          <p className="text-sm font-semibold tabular-nums">{formatMoney(amount)}</p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showDiscount && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }} className="-m-1 overflow-hidden p-1 pl-7">
            <div className="mt-1 flex items-end gap-2">
              <Field label="Discount" className="flex-1">
                {item.discount?.kind === "amount" ? (
                  <MoneyInput field={`${p}.discount`} value={item.discount.value} onChange={(v) => set("discount", (it) => void (it.discount = { kind: "amount", value: v }))} />
                ) : (
                  <NumberInput field={`${p}.discount`} decimals={2} suffix="%" value={item.discount?.value ?? 0} onChange={(v) => set("discount", (it) => void (it.discount = { kind: "percent", value: Math.min(100, v) }))} />
                )}
              </Field>
              <Segmented
                label="Discount type"
                layoutId={`disc-${item.id}`}
                value={item.discount?.kind ?? "percent"}
                options={[
                  { value: "percent", label: "%" },
                  { value: "amount", label: "₹" },
                ]}
                onChange={(k) => set("discount", (it) => void (it.discount = { kind: k, value: 0 }))}
                className="mb-0.5"
              />
            </div>
          </motion.div>
        )}
        {showDesc && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }} className="-m-1 overflow-hidden p-1 pl-7">
            <Textarea
              data-field={`${p}.description`}
              value={item.description ?? ""}
              rows={2}
              placeholder="Description printed under the item"
              onChange={(e) => set("description", (it) => void (it.description = e.target.value))}
              className="mt-1 min-h-14 resize-y text-sm md:text-sm"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-1.5 flex gap-3 pl-7 text-xs">
        {!showDesc && (
          <button type="button" onClick={() => setShowDesc(true)} className="font-medium text-foreground/70 hover:text-foreground">
            + Add description
          </button>
        )}
        {!showDiscount ? (
          <button type="button" onClick={() => setShowDiscount(true)} className="font-medium text-foreground/70 hover:text-foreground">
            + Discount
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowDiscount(false)
              set("discount", (it) => void (it.discount = undefined))
            }}
            className="font-medium text-foreground/70 hover:text-foreground"
          >
            Remove discount
          </button>
        )}
      </div>
    </motion.li>
  )
}

function ColumnsMenu({ ed }: { ed: EditorApi }) {
  const cols = ed.invoice.columns
  const entries = [
    ["hsn", "HSN / SAC"],
    ["unit", "Unit"],
    ["discount", "Discount"],
    ["tax", "Tax"],
  ] as const
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
        <Columns3Icon className="size-3.5" /> Columns
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show on the invoice</DropdownMenuLabel>
          {entries.map(([key, label]) => (
            <DropdownMenuCheckboxItem key={key} checked={cols[key]} onCheckedChange={(v) => ed.update((d) => void (d.columns[key] = !!v))}>
              {label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CatalogPicker({ ed, onAdd }: { ed: EditorApi; onAdd: (items: EditorApi["catalog"]) => void }) {
  const [open, setOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setPicked(new Set())
      }}
    >
      <PopoverTrigger render={<Button variant="outline" className="h-9 text-[13px]" />}>
        <PackageIcon /> Add from catalog
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search your items" />
          <CommandList>
            <CommandEmpty>No items. Save one from the ⋯ menu.</CommandEmpty>
            <CommandGroup>
              {ed.catalog.map((c) => (
                <CommandItem key={c.id} value={`${c.name} ${c.hsnSac ?? ""}`} data-checked={picked.has(c.id)} onSelect={() => toggle(c.id)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatMoney(c.rate)} / {c.unit} · {c.taxRate}%
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t p-1.5">
            <Button
              className="h-8 w-full text-[13px]"
              disabled={picked.size === 0}
              onClick={() => {
                onAdd(ed.catalog.filter((c) => picked.has(c.id)))
                setOpen(false)
                setPicked(new Set())
              }}
            >
              Add {picked.size || ""} item{picked.size === 1 ? "" : "s"}
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
