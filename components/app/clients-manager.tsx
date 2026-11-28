"use client"

import * as React from "react"
import { LoaderCircleIcon, LockIcon } from "lucide-react"
import { cn } from "cn"

import { Combobox, SelectField } from "@/components/invoice-editor/fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { saveClientRemote } from "@/lib/client/workspace"
import type { Client } from "@/lib/invoice/defaults"
import { STATES, stateLabel } from "@/lib/invoice/config"
import { uid } from "@/lib/invoice/format"
import { panFromGstin, RX } from "@/lib/invoice/validate"

/**
 * The add/edit client dialog, used by /clients (components/clients) and
 * anywhere else a client is created.
 */

/* ------------------------------- the form ------------------------------ */

const EMPTY: Client = { id: "", name: "", gstin: "", pan: "", email: "", phone: "", address: { line1: "", line2: "", city: "", pin: "", stateCode: "", country: "India" } }
const COUNTRIES = ["India", "United Arab Emirates", "United States", "United Kingdom", "Singapore"].map((c) => ({ value: c, label: c }))
const stateOptions = STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})`, keywords: [s.code] }))
const ctl = "h-9 bg-background text-[13px] md:text-[13px]"

export function ClientDialog({ client, onClose, onSaved }: { client: Client | "new" | null; onClose: () => void; onSaved: (c: Client, isNew: boolean) => void }) {
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
