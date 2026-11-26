"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FilePlus2Icon, LoaderCircleIcon, LockIcon, MoreHorizontalIcon, PencilLineIcon, PlusIcon, SearchIcon, Trash2Icon, UsersIcon } from "lucide-react"
import { cn } from "cn"

import { Combobox, SelectField } from "@/components/invoice-editor/fields"
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
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { deleteClientRemote, saveClientRemote } from "@/lib/client/workspace"
import type { ClientWithStats } from "@/lib/data/types"
import type { Client } from "@/lib/invoice/defaults"
import { STATES, stateLabel } from "@/lib/invoice/config"
import { formatDate, uid } from "@/lib/invoice/format"
import { formatMoney } from "@/lib/invoice/totals"
import { panFromGstin, RX } from "@/lib/invoice/validate"

import { EmptyState } from "./states"

const money = (n: number) => formatMoney(n, { whole: true })
const COLS = "minmax(0,2fr) minmax(0,1.2fr) 5rem 1fr 1fr 8.5rem"

/** /clients: everyone you bill, what they've been billed and what they owe. */
export function ClientsManager({ clients }: { clients: ClientWithStats[] }) {
  const [q, setQ] = React.useState("")
  const [owesOnly, setOwesOnly] = React.useState(false)
  const [byOwed, setByOwed] = React.useState(false)
  const [editing, setEditing] = React.useState<Client | "new" | null>(null)
  const [deleting, setDeleting] = React.useState<ClientWithStats | null>(null)
  const router = useRouter()
  const toast = useToast()

  const term = q.trim().toLowerCase()
  const matched = (term ? clients.filter((c) => [c.name, c.gstin, c.email, c.phone, c.address.city].some((v) => v?.toLowerCase().includes(term))) : clients).filter((c) => !owesOnly || c.outstanding > 0)
  const shown = byOwed ? [...matched].sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name)) : matched
  const owed = clients.reduce((s, c) => s + c.outstanding, 0)

  async function remove(c: ClientWithStats) {
    setDeleting(null)
    try {
      await deleteClientRemote(c.id)
      toast({ title: `${c.name} removed`, description: "Their invoices keep their details.", tone: "success", duration: 3000 })
      router.refresh()
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" })
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted-foreground">
          {clients.length} client{clients.length === 1 ? "" : "s"}
          {owed > 0 && (
            <>
              {" "}
              · <span className="font-medium text-foreground">{money(owed)}</span> owed to you
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={owesOnly}
            onClick={() => setOwesOnly((v) => !v)}
            className={cn("h-8 shrink-0 rounded-lg border px-2.5 text-[13px] transition-colors", owesOnly ? "border-brand/40 bg-brand/8 font-medium text-foreground" : "bg-background text-foreground/75 hover:bg-muted")}
          >
            Owes you
          </button>
          <div className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients"
              aria-label="Search clients"
              className="h-8 w-full rounded-lg border bg-background pr-3 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <Button className="h-8 shrink-0 gap-1.5 px-3 text-[13px]" onClick={() => setEditing("new")}>
            <PlusIcon /> Add client
          </Button>
        </div>
      </div>

      {clients.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No clients yet" body="Save the people and businesses you bill. Their name, GSTIN and address then fill in with one click.">
          <Button className="mt-5 h-8 gap-1.5 px-3 text-[13px]" onClick={() => setEditing("new")}>
            <PlusIcon /> Add your first client
          </Button>
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={SearchIcon} title={`No clients match “${q}”`} body="Search by name, GSTIN, email, phone or city." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="hidden grid-cols-(--cols) gap-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid" style={{ "--cols": COLS } as React.CSSProperties}>
            <span>Client</span>
            <span>Location</span>
            <span className="text-right">Invoices</span>
            <span className="text-right">Billed</span>
            <button type="button" onClick={() => setByOwed((v) => !v)} aria-label={byOwed ? "Sorted by amount owed. Sort by name" : "Sort by amount owed"} className={cn("text-right uppercase hover:text-foreground", byOwed && "text-foreground")}>
              Owes you {byOwed ? "↓" : ""}
            </button>
            <span />
          </div>
          <ul className="divide-y">
            {shown.map((c) => (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-[13px] md:grid-cols-(--cols)" style={{ "--cols": COLS } as React.CSSProperties}>
                <Link href={`/clients/${encodeURIComponent(c.id)}`} className="min-w-0 text-left outline-none hover:underline focus-visible:underline">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="block truncate text-muted-foreground">{c.gstin || c.email || c.phone || "No GSTIN"}</span>
                </Link>
                <span className="hidden truncate text-foreground/85 md:block">{[c.address.city, c.address.stateCode && stateLabel(c.address.stateCode)].filter(Boolean).join(", ") || "—"}</span>
                <span className="hidden text-right tabular-nums md:block">{c.invoices || "—"}</span>
                <span className="hidden text-right tabular-nums md:block">{c.billed ? money(c.billed) : "—"}</span>
                <span className={cn("text-right font-medium tabular-nums", c.overdue > 0 && "text-red-600 dark:text-red-400")} title={c.overdue > 0 ? `${money(c.overdue)} overdue` : undefined}>
                  {c.outstanding ? money(c.outstanding) : <span className="text-muted-foreground">—</span>}
                </span>
                <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1">
                  <Link href={`/create?client=${encodeURIComponent(c.id)}`} className={cn(buttonVariants({ variant: "outline" }), "h-7 gap-1.5 px-2.5 text-xs")}>
                    <FilePlus2Icon /> Invoice
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${c.name}`} className="text-foreground/70" />}>
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44 rounded-xl p-1.5">
                      <DropdownMenuItem className="gap-2 py-1.5 text-[13px]" onClick={() => setEditing(c)}>
                        <PencilLineIcon /> Edit details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 py-1.5 text-[13px]" render={<Link href={`/clients/${encodeURIComponent(c.id)}`} />}>
                        <SearchIcon /> Balance and statement
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" className="gap-2 py-1.5 text-[13px]" onClick={() => setDeleting(c)}>
                        <Trash2Icon /> Remove client
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {c.lastInvoiceDate && <span className="col-span-2 text-[11px] text-muted-foreground md:hidden">Last invoice {formatDate(c.lastInvoiceDate)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ClientDialog
        client={editing}
        onClose={() => setEditing(null)}
        onSaved={(c, isNew) => {
          setEditing(null)
          toast({ title: isNew ? `${c.name} added` : `${c.name} updated`, tone: "success", duration: 2500 })
          router.refresh()
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won&apos;t be in your client list any more. {deleting?.invoices ? `Their ${deleting.invoices} invoice${deleting.invoices === 1 ? "" : "s"} stay as they are.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" className="h-8 text-[13px]" onClick={() => deleting && remove(deleting)}>
              Remove client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ------------------------------- the form ------------------------------ */

const EMPTY: Client = { id: "", name: "", gstin: "", pan: "", email: "", phone: "", address: { line1: "", line2: "", city: "", pin: "", stateCode: "", country: "India" } }
const COUNTRIES = ["India", "United Arab Emirates", "United States", "United Kingdom", "Singapore"].map((c) => ({ value: c, label: c }))
const stateOptions = STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})`, keywords: [s.code] }))
const ctl = "h-9 bg-background text-[13px] md:text-[13px]"

function ClientDialog({ client, onClose, onSaved }: { client: Client | "new" | null; onClose: () => void; onSaved: (c: Client, isNew: boolean) => void }) {
  return (
    <Dialog open={client !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-[560px]">
        {client !== null && <ClientForm key={client === "new" ? "new" : client.id} initial={client === "new" ? null : client} onSaved={onSaved} onCancel={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ClientForm({ initial, onSaved, onCancel }: { initial: Client | null; onSaved: (c: Client, isNew: boolean) => void; onCancel: () => void }) {
  const [c, setC] = React.useState<Client>(() => ({ ...EMPTY, ...initial, address: { ...EMPTY.address, ...initial?.address } }))
  const [tried, setTried] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const isNew = !initial
  const india = (c.address.country || "India") === "India"
  const gstinValid = !!c.gstin && RX.gstin.test(c.gstin)

  const errors: Record<string, string> = {}
  if (!c.name.trim()) errors.name = "Enter a name"
  if (c.gstin && !RX.gstin.test(c.gstin)) errors.gstin = "GSTIN is 15 characters, like 27AABCM4321P1Z7"
  if (c.email && !RX.email.test(c.email)) errors.email = "Check the email address"
  if (c.phone && !RX.phone.test(c.phone)) errors.phone = "Check the phone number"
  if (c.address.pin && india && !RX.pin.test(c.address.pin)) errors.pin = "PIN code is 6 digits"
  const show = (k: string) => (tried ? errors[k] : undefined)

  const set = (patch: Partial<Client>) => setC((x) => ({ ...x, ...patch }))
  const setAddr = (patch: Partial<Client["address"]>) => setC((x) => ({ ...x, address: { ...x.address, ...patch } }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) return
    setPending(true)
    setError(null)
    const saved: Client = { ...c, id: c.id || uid("cl"), name: c.name.trim() }
    try {
      await saveClientRemote(saved)
      onSaved(saved, isNew)
    } catch (err) {
      setError((err as Error).message)
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="border-b px-5 py-4">
        <DialogTitle className="text-[15px] font-semibold">{isNew ? "Add a client" : `Edit ${initial?.name}`}</DialogTitle>
        <DialogDescription className="mt-0.5 text-xs text-muted-foreground">Saved to your account. Invoices you&apos;ve already made keep the details they were sent with.</DialogDescription>
      </div>
      <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
        <F label="Name" required error={show("name")} className="sm:col-span-2">
          <Input autoFocus value={c.name} maxLength={200} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!show("name") || undefined} className={ctl} />
        </F>
        <F label="GSTIN" error={show("gstin")} hint={gstinValid ? `State set to ${stateLabel(c.gstin!.slice(0, 2))}` : "Leave empty for consumers"}>
          <Input
            value={c.gstin ?? ""}
            maxLength={15}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/\s/g, "")
              if (RX.gstin.test(v)) setC((x) => ({ ...x, gstin: v, pan: panFromGstin(v), address: { ...x.address, stateCode: v.slice(0, 2), country: "India" } }))
              else set({ gstin: v })
            }}
            aria-invalid={!!show("gstin") || undefined}
            className={cn(ctl, "uppercase")}
          />
        </F>
        <F label="Country">
          <SelectField field="client.country" value={c.address.country || "India"} options={COUNTRIES} onChange={(v) => setAddr({ country: v })} />
        </F>
        <F label="Email" error={show("email")}>
          <Input type="email" value={c.email ?? ""} onChange={(e) => set({ email: e.target.value })} aria-invalid={!!show("email") || undefined} className={ctl} />
        </F>
        <F label="Phone" error={show("phone")} hint="Used for WhatsApp reminders">
          <Input type="tel" placeholder="+91 " value={c.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} aria-invalid={!!show("phone") || undefined} className={ctl} />
        </F>
        <F label="Address" className="sm:col-span-2">
          <Input placeholder="Building, street" value={c.address.line1} onChange={(e) => setAddr({ line1: e.target.value })} className={ctl} />
        </F>
        <F label="Address line 2" className="sm:col-span-2">
          <Input placeholder="Area, landmark (optional)" value={c.address.line2 ?? ""} onChange={(e) => setAddr({ line2: e.target.value })} className={ctl} />
        </F>
        <F label="City">
          <Input value={c.address.city} onChange={(e) => setAddr({ city: e.target.value })} className={ctl} />
        </F>
        <F label={india ? "PIN code" : "Postal code"} error={show("pin")}>
          <Input value={c.address.pin ?? ""} inputMode={india ? "numeric" : "text"} maxLength={india ? 6 : 12} onChange={(e) => setAddr({ pin: india ? e.target.value.replace(/\D/g, "") : e.target.value })} aria-invalid={!!show("pin") || undefined} className={ctl} />
        </F>
        {india && (
          <F label="State" hint="Decides CGST + SGST or IGST" aside={gstinValid ? <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><LockIcon className="size-3" /> From GSTIN</span> : null} className="sm:col-span-2">
            <Combobox field="client.state" value={c.address.stateCode} options={stateOptions} disabled={gstinValid} placeholder="Choose state" searchPlaceholder="Search states or codes" onChange={(v) => setAddr({ stateCode: v })} />
          </F>
        )}
      </div>
      {error && <p className="mx-5 mb-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
        <Button type="button" variant="ghost" className="h-8 text-[13px]" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="h-8 min-w-24 text-[13px]" disabled={pending}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : isNew ? "Add client" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

/** Label above, hint or error below, tied to the control inside. */
export function F({ label, required, error, hint, aside, className, children }: { label: string; required?: boolean; error?: string; hint?: string; aside?: React.ReactNode; className?: string; children: React.ReactElement<{ id?: string; "aria-describedby"?: string }> }) {
  const id = React.useId()
  const control = React.cloneElement(children, { id, "aria-describedby": error || hint ? `${id}-note` : undefined })
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-foreground/85">
          {label}
          {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
        </label>
        {aside}
      </div>
      {control}
      {error ? (
        <p id={`${id}-note`} className="text-[11px] text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-note`} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
