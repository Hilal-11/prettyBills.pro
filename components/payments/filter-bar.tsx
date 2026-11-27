"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CalendarRangeIcon, CheckIcon, ChevronDownIcon, LoaderCircleIcon, UsersIcon, WalletIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { ListSearch } from "@/components/app/list-controls"
import { DateField } from "@/components/invoice-editor/fields"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDate, PRESET_LABEL, todayIST, type DatePreset } from "@/lib/billing/dates"
import { filtersQuery, type ListFilters } from "@/lib/billing/filters"
import { MODE_LABEL, PAYMENT_MODES, type PaymentMode } from "@/lib/billing/modes"

const PRESETS: DatePreset[] = ["today", "this_week", "this_month", "last_30", "last_month", "this_fy", "last_fy", "all"]

const trigger = "h-8 gap-1.5 px-2.5 text-[13px] font-normal"

/**
 * Date range, client, mode (and receipt status) filters. Each change rewrites
 * the URL, so the server renders the filtered list and the view can be shared.
 */
export function FilterBar({ filters, clients, defaults, searchPlaceholder, statusFilter = false }: { filters: ListFilters; clients: { id: string; name: string }[]; defaults: ListFilters; searchPlaceholder: string; statusFilter?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = React.useTransition()

  const go = (patch: Partial<ListFilters>) => {
    const next = { ...filters, ...patch }
    const q = filtersQuery(next)
    start(() => router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false }))
  }
  const dirty = filtersQuery(filters) !== filtersQuery(defaults)

  return (
    <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <DateRange filters={filters} onChange={go} />
        <MultiPick
          icon={UsersIcon}
          label="Client"
          all="All clients"
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
          value={filters.clients}
          onChange={(clients) => go({ clients })}
          searchable
        />
        <MultiPick icon={WalletIcon} label="Mode" all="All modes" options={PAYMENT_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))} value={filters.modes} onChange={(modes) => go({ modes: modes as PaymentMode[] })} />
        {statusFilter && (
          <div role="radiogroup" aria-label="Receipt status" className="inline-flex rounded-lg border bg-muted/50 p-0.5">
            {(["active", "void", "all"] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={filters.status === s} onClick={() => go({ status: s })} className={cn("h-7 rounded-md px-2.5 text-xs font-medium capitalize transition-colors", filters.status === s ? "border bg-background text-foreground shadow-xs" : "text-foreground/60 hover:text-foreground")}>
                {s}
              </button>
            ))}
          </div>
        )}
        {dirty && (
          <Button variant="ghost" className="h-8 gap-1 px-2 text-[13px] text-muted-foreground" onClick={() => start(() => router.replace(pathname, { scroll: false }))}>
            <XIcon className="size-3.5" /> Clear filters
          </Button>
        )}
        {pending && <LoaderCircleIcon aria-label="Updating" className="size-3.5 animate-spin text-muted-foreground" />}
      </div>
      <ListSearch placeholder={searchPlaceholder} />
    </div>
  )
}

function DateRange({ filters, onChange }: { filters: ListFilters; onChange: (p: Partial<ListFilters>) => void }) {
  const [open, setOpen] = React.useState(false)
  const [from, setFrom] = React.useState(filters.from ?? "")
  const [to, setTo] = React.useState(filters.to ?? "")
  const today = React.useMemo(() => todayIST(), [])
  const label = filters.preset === "custom" ? `${filters.from ? formatDate(filters.from) : "Start"} – ${filters.to ? formatDate(filters.to) : "Today"}` : PRESET_LABEL[filters.preset]
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setFrom(filters.from ?? "")
          setTo(filters.to ?? "")
        }
      }}
    >
      <PopoverTrigger render={<Button variant="outline" className={trigger} aria-label={`Date range: ${label}`} />}>
        <CalendarRangeIcon className="size-3.5 text-muted-foreground" /> {label}
        <ChevronDownIcon className="size-3.5 text-foreground/50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <div className="grid grid-cols-2 gap-0.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setOpen(false)
                onChange({ preset: p })
              }}
              className={cn("flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted", filters.preset === p && "font-medium")}
            >
              {PRESET_LABEL[p]}
              {filters.preset === p && <CheckIcon className="size-3.5" />}
            </button>
          ))}
        </div>
        <div className="mt-1.5 grid gap-2 border-t px-1 pt-2.5 pb-1">
          <p className="text-xs font-medium text-muted-foreground">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <DateField field="filter-from" value={from} max={to || today} onChange={setFrom} />
            <DateField field="filter-to" value={to} min={from || undefined} max={today} onChange={setTo} />
          </div>
          <Button
            className="h-8 text-[13px]"
            disabled={!from && !to}
            onClick={() => {
              setOpen(false)
              onChange({ preset: "custom", from: from || null, to: to || null })
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MultiPick({
  icon: Icon,
  label,
  all,
  options,
  value,
  onChange,
  searchable,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  all: string
  options: { value: string; label: string }[]
  value: string[]
  onChange: (v: string[]) => void
  searchable?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<string[]>(value)
  const names = options.filter((o) => value.includes(o.value)).map((o) => o.label)
  const shown = value.length === 0 ? all : value.length === 1 ? (names[0] ?? `1 ${label.toLowerCase()}`) : `${value.length} ${label.toLowerCase()}s`
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft(value)
        else if (draft.join() !== value.join()) onChange(draft)
      }}
    >
      <PopoverTrigger render={<Button variant="outline" className={cn(trigger, value.length && "border-brand/40 bg-brand/5")} aria-label={`${label}: ${shown}`} />}>
        <Icon className="size-3.5 text-muted-foreground" /> <span className="max-w-36 truncate">{shown}</span>
        <ChevronDownIcon className="size-3.5 text-foreground/50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          {searchable && <CommandInput placeholder={`Search ${label.toLowerCase()}s`} />}
          <CommandList className="max-h-72">
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const on = draft.includes(o.value)
                return (
                  <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => setDraft((d) => (on ? d.filter((x) => x !== o.value) : [...d, o.value]))} className="gap-2 text-[13px]">
                    <span className={cn("grid size-4 place-items-center rounded border", on && "border-brand bg-brand text-white")}>{on && <CheckIcon className="size-3" />}</span>
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex justify-between gap-2 border-t p-1.5">
            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDraft([])}>
              Clear
            </Button>
            <Button
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                setOpen(false)
                onChange(draft)
              }}
            >
              Apply
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
