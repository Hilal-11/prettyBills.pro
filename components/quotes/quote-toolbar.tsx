"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarIcon, ChevronDownIcon, CrownIcon, HourglassIcon, LoaderCircleIcon, Settings2Icon, UsersIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { saveQuoteSettingsAction } from "@/app/(app)/quotes/actions"
import { Field, SelectField, ToggleRow } from "@/components/invoice-editor/fields"
import { useToast } from "@/components/invoice-editor/toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PRESET_LABEL, type DatePreset } from "@/lib/billing/dates"
import { VALIDITY_PRESETS } from "@/lib/billing/quotes"
import type { QuoteSettings } from "@/lib/server/db/quotes"

const PRESETS: DatePreset[] = ["all", "this_month", "last_30", "last_month", "this_fy", "last_fy"]
const ctl = "h-8 gap-1.5 px-2.5 text-[13px]"

/** Client, date range and "Expiring soon", each kept in the URL. */
export function QuoteFilters({ clients, kind }: { clients: { id: string; name: string }[]; kind: "quote" | "proforma" }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = React.useTransition()
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete("page")
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }))
  }
  const client = params.get("client") ?? ""
  const preset = (params.get("date") as DatePreset | null) ?? "all"
  const expiring = params.get("expiring") === "1"
  const clientName = clients.find((c) => c.id === client)?.name

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-busy={pending || undefined}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" className={cn(ctl, client && "border-brand/40 bg-brand/5")} />}>
          <UsersIcon className="size-3.5" />
          <span className="max-w-32 truncate">{clientName ?? "All clients"}</span>
          <ChevronDownIcon className="size-3.5 text-foreground/50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Client</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={client} onValueChange={(v) => set({ client: (v as string) || null })}>
              <DropdownMenuRadioItem value="">All clients</DropdownMenuRadioItem>
              {clients.map((c) => (
                <DropdownMenuRadioItem key={c.id} value={c.id}>
                  <span className="truncate">{c.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" className={cn(ctl, preset !== "all" && "border-brand/40 bg-brand/5")} />}>
          <CalendarIcon className="size-3.5" />
          {preset === "all" ? "Any date" : PRESET_LABEL[preset]}
          <ChevronDownIcon className="size-3.5 text-foreground/50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Issue date</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={preset} onValueChange={(v) => set({ date: v === "all" ? null : (v as string) })}>
              {PRESETS.map((p) => (
                <DropdownMenuRadioItem key={p} value={p}>
                  {p === "all" ? "Any date" : PRESET_LABEL[p]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {kind === "quote" && (
        <Button variant="outline" aria-pressed={expiring} className={cn(ctl, expiring && "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300")} onClick={() => set({ expiring: expiring ? null : "1", tab: null })}>
          <HourglassIcon className="size-3.5" /> Expiring soon
          {expiring && <XIcon className="size-3" />}
        </Button>
      )}
      {pending && <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" aria-label="Updating" />}
    </div>
  )
}

/** Business settings for quotes: title, default validity, conversions, automation. */
export function QuoteSettingsButton({ settings, pro }: { settings: QuoteSettings; pro: boolean }) {
  const toast = useToast()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(settings)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastOpen, setLastOpen] = React.useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(settings)
      setError(null)
    }
  }
  async function save() {
    setBusy(true)
    const res = await saveQuoteSettingsAction(form)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    toast({ title: "Quote settings saved", tone: "success", duration: 2500 })
  }
  return (
    <>
      <Button variant="outline" size="icon-sm" className="size-8" aria-label="Quote settings" title="Quote settings" onClick={() => setOpen(true)}>
        <Settings2Icon />
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="gap-4 p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Quote settings</DialogTitle>
            <DialogDescription>Defaults for new quotes and what happens when clients answer.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Printed title">
              <SelectField field="quoteTitle" value={form.title} options={[{ value: "Quotation", label: "Quotation" }, { value: "Estimate", label: "Estimate" }]} onChange={(v) => setForm({ ...form, title: v as QuoteSettings["title"] })} />
            </Field>
            <Field label="Valid for">
              <SelectField
                field="validity"
                value={String(form.validityDays)}
                options={[...new Set([...VALIDITY_PRESETS, form.validityDays])].sort((a, b) => a - b).map((d) => ({ value: String(d), label: `${d} days` }))}
                onChange={(v) => setForm({ ...form, validityDays: Number(v) })}
              />
            </Field>
          </div>
          <div className="divide-y rounded-lg border">
            <ToggleRow label="Allow multiple invoices from one quote" hint="For milestone billing: invoice part of the items, then the rest later" checked={form.allowMultiple} onChange={(v) => setForm({ ...form, allowMultiple: v })} />
            <ToggleRow label="Auto-convert accepted quotes" hint="When a client accepts online, a draft invoice is made for you" checked={form.autoConvert} onChange={(v) => setForm({ ...form, autoConvert: v })} />
            <ToggleRow
              label="Remind clients before a quote expires"
              hint={
                <span className="inline-flex items-center gap-1">
                  <CrownIcon className="size-3 text-amber-500" aria-hidden />
                  {pro ? "Pro: an email 2 days before Valid until, if it's still unanswered" : "Part of PrettyBills Pro"}
                </span>
              }
              disabled={!pro}
              checked={pro && form.expiryReminders}
              onChange={(v) => setForm({ ...form, expiryReminders: v })}
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="-mx-5 -mb-5 p-4">
            <Button variant="outline" className="h-8 text-[13px]" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="h-8 text-[13px]" disabled={busy} onClick={() => void save()}>
              {busy && <LoaderCircleIcon className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
