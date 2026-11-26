"use client"

import * as React from "react"
import { PencilIcon, PlusIcon, UserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CURRENCIES, STATES, stateLabel } from "@/lib/invoice/config"
import { partyFromClient, type Client } from "@/lib/invoice/defaults"
import { uid } from "@/lib/invoice/format"
import type { PartySnapshot, SupplyType } from "@/lib/invoice/types"
import { RX } from "@/lib/invoice/validate"

import { Combobox, Field, Segmented, SelectField, TextField, ToggleRow } from "../fields"
import { SectionCard } from "../section-card"
import type { EditorApi } from "../use-editor"

const stateOptions = STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})`, keywords: [s.code] }))

function supplyFor(c: PartySnapshot): SupplyType {
  if (c.address.stateCode === "96" || (c.address.country && c.address.country !== "India")) return "export"
  return c.gstin ? "b2b" : "b2c"
}

export function ClientSection({ ed }: { ed: EditorApi }) {
  const inv = ed.invoice
  const [drawer, setDrawer] = React.useState<{ open: boolean; client?: Client }>({ open: false })
  const [overriding, setOverriding] = React.useState(false)
  const err = (p: string) => ed.errorFor(p)

  // payments are recorded against this client: the invoice can't move to another one
  const locked = inv.payment.amountPaid > 0

  function selectClient(c: Client) {
    if (locked && c.id !== inv.clientId) return
    ed.update((d) => {
      d.clientId = c.id
      d.billTo = partyFromClient(c)
      d.supplyType = supplyFor(c)
      d.placeOfSupply = d.shipTo?.stateCode || (d.supplyType === "export" ? "96" : c.address.stateCode)
    }, "client")
    setOverriding(false)
  }

  const options = ed.clients.map((c) => ({
    value: c.id,
    label: c.name,
    hint: [c.address.city, c.gstin].filter(Boolean).join(" · "),
    keywords: [c.gstin ?? "", c.address.city],
  }))

  const b = inv.billTo
  return (
    <SectionCard ed={ed} id="client" icon={UserIcon} title="Client" summary={b.name ? `${b.name} · ${b.address.city}` : "Choose a client"}>
      <Field label="Client" required error={err("billTo.name")} help={locked ? "This invoice has payments, so its client can't change. You can still edit their details." : undefined}>
        <Combobox
          field="clientId"
          value={inv.clientId}
          options={options}
          placeholder="Choose a client"
          searchPlaceholder="Search by name, GSTIN or city"
          onChange={(id) => {
            const c = ed.clients.find((x) => x.id === id)
            if (c) selectClient(c)
          }}
          footer={(close) => (
            <button
              type="button"
              onClick={() => {
                close()
                setDrawer({ open: true })
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-brand hover:bg-muted dark:text-[#6da2ff]"
            >
              <PlusIcon className="size-4" /> New client
            </button>
          )}
        />
      </Field>

      {b.name && !overriding && (
        <div className="rounded-lg border bg-background/60 p-3 text-[13px]">
          <p className="font-semibold">{b.name}</p>
          <p className="text-foreground/75">{[b.address.line1, b.address.line2, b.address.city, [stateLabel(b.address.stateCode), b.address.pin].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
          <p className="mt-1 text-foreground/75">{[b.gstin && `GSTIN ${b.gstin}`, b.email, b.phone].filter(Boolean).join(" · ") || "No GSTIN or contact details"}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOverriding(true)}>
              <PencilIcon /> Edit for this invoice
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDrawer({ open: true, client: ed.clients.find((c) => c.id === inv.clientId) })}
            >
              Edit client
            </Button>
          </div>
        </div>
      )}

      {overriding && (
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <p className="text-xs text-foreground/70">Changes here apply to this invoice only. The saved client stays the same.</p>
          <PartyFields
            prefix="billTo"
            value={b}
            onChange={(next) =>
              ed.update((d) => {
                d.billTo = next
              }, "billTo")
            }
            errorFor={err}
            touch={ed.touch}
          />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOverriding(false)}>
            Done
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <ToggleRow
          label="Shipping address is different"
          checked={!!inv.shipTo}
          onChange={(on) =>
            ed.update((d) => {
              d.shipTo = on ? { name: d.billTo.name, line1: "", line2: "", city: "", pin: "", stateCode: d.billTo.address.stateCode, country: "India" } : undefined
              if (!on && d.supplyType !== "export") d.placeOfSupply = d.billTo.address.stateCode
            })
          }
        />
      </div>
      {inv.shipTo && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ship to name" required error={err("shipTo.name")} className="col-span-2">
            <TextField field="shipTo.name" value={inv.shipTo.name} error={err("shipTo.name")} onBlur={() => ed.touch("shipTo.name")} onChange={(v) => ed.update((d) => void (d.shipTo!.name = v), "shipTo.name")} />
          </Field>
          <Field label="Address" required error={err("shipTo.line1")} className="col-span-2">
            <TextField field="shipTo.line1" value={inv.shipTo.line1} error={err("shipTo.line1")} onBlur={() => ed.touch("shipTo.line1")} onChange={(v) => ed.update((d) => void (d.shipTo!.line1 = v), "shipTo.line1")} />
          </Field>
          <Field label="City" required error={err("shipTo.city")}>
            <TextField field="shipTo.city" value={inv.shipTo.city} error={err("shipTo.city")} onBlur={() => ed.touch("shipTo.city")} onChange={(v) => ed.update((d) => void (d.shipTo!.city = v), "shipTo.city")} />
          </Field>
          <Field label="PIN code">
            <TextField field="shipTo.pin" inputMode="numeric" maxLength={6} value={inv.shipTo.pin} onChange={(v) => ed.update((d) => void (d.shipTo!.pin = v.replace(/\D/g, "")), "shipTo.pin")} />
          </Field>
          <Field label="State" className="col-span-2">
            <Combobox
              field="shipTo.stateCode"
              value={inv.shipTo.stateCode}
              options={stateOptions}
              onChange={(v) =>
                ed.update((d) => {
                  d.shipTo!.stateCode = v
                  if (d.supplyType !== "export") d.placeOfSupply = v
                })
              }
            />
          </Field>
        </div>
      )}

      <Field label="Place of supply" required error={err("placeOfSupply")} help="Decides IGST vs CGST + SGST">
        <Combobox field="placeOfSupply" value={inv.placeOfSupply} options={stateOptions} placeholder="Choose state" onChange={(v) => ed.update((d) => void (d.placeOfSupply = v))} />
      </Field>

      <Field label="Client type">
        <Segmented
          label="Client type"
          layoutId="supply-type"
          value={inv.supplyType}
          options={[
            { value: "b2b", label: "Business (B2B)" },
            { value: "b2c", label: "Consumer (B2C)" },
            { value: "export", label: "Export" },
          ]}
          onChange={(v) =>
            ed.update((d) => {
              d.supplyType = v
              if (v === "export") d.placeOfSupply = "96"
              else if (d.placeOfSupply === "96") d.placeOfSupply = d.shipTo?.stateCode || d.billTo.address.stateCode
              if (v !== "export") d.currency = "INR"
            })
          }
        />
      </Field>
      {inv.supplyType === "export" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency">
            <SelectField field="currency" value={inv.currency} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))} onChange={(v) => ed.update((d) => void (d.currency = v))} />
          </Field>
          <Field label="LUT / bond number" help="Exports under LUT are zero-rated">
            <TextField field="lut" value={inv.lut} onChange={(v) => ed.update((d) => void (d.lut = v), "lut")} />
          </Field>
        </div>
      )}

      <ClientDrawer
        open={drawer.open}
        client={drawer.client}
        onOpenChange={(open) => setDrawer((s) => ({ ...s, open }))}
        onSave={(c) => {
          ed.saveClient(c)
          selectClient(c)
          setDrawer({ open: false })
        }}
      />
    </SectionCard>
  )
}

/** Name/address/GST/contact fields shared by the drawer and the inline override. */
function PartyFields({
  prefix,
  value,
  onChange,
  errorFor,
  touch,
}: {
  prefix: string
  value: PartySnapshot
  onChange: (p: PartySnapshot) => void
  errorFor?: (p: string) => string | undefined
  touch?: (p: string) => void
}) {
  const set = (patch: Partial<PartySnapshot>) => onChange({ ...value, ...patch })
  const setAddr = (patch: Partial<PartySnapshot["address"]>) => onChange({ ...value, address: { ...value.address, ...patch } })
  const e = (k: string) => errorFor?.(`${prefix}.${k}`)
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Name" required className="col-span-2" error={e("name")}>
        <TextField field={`${prefix}.name`} value={value.name} onBlur={() => touch?.(`${prefix}.name`)} onChange={(v) => set({ name: v })} />
      </Field>
      <Field label="GSTIN" error={e("gstin")}>
        <TextField
          field={`${prefix}.gstin`}
          upper
          maxLength={15}
          value={value.gstin}
          onBlur={() => touch?.(`${prefix}.gstin`)}
          onChange={(v) => onChange({ ...value, gstin: v, address: RX.gstin.test(v) ? { ...value.address, stateCode: v.slice(0, 2) } : value.address })}
        />
      </Field>
      <Field label="Email">
        <TextField field={`${prefix}.email`} type="email" value={value.email} onChange={(v) => set({ email: v })} />
      </Field>
      <Field label="Address line 1" className="col-span-2">
        <TextField field={`${prefix}.address.line1`} value={value.address.line1} onChange={(v) => setAddr({ line1: v })} />
      </Field>
      <Field label="City">
        <TextField field={`${prefix}.address.city`} value={value.address.city} onChange={(v) => setAddr({ city: v })} />
      </Field>
      <Field label="PIN code">
        <TextField field={`${prefix}.address.pin`} inputMode="numeric" maxLength={6} value={value.address.pin} onChange={(v) => setAddr({ pin: v.replace(/\D/g, "") })} />
      </Field>
      <Field label="State" className="col-span-2">
        <Combobox field={`${prefix}.address.stateCode`} value={value.address.stateCode} options={stateOptions} onChange={(v) => setAddr({ stateCode: v })} />
      </Field>
      <Field label="Phone" help="Used for WhatsApp sharing" className="col-span-2">
        <TextField field={`${prefix}.phone`} type="tel" placeholder="+91 " value={value.phone} onChange={(v) => set({ phone: v })} />
      </Field>
    </div>
  )
}

function ClientDrawer({ open, client, onOpenChange, onSave }: { open: boolean; client?: Client; onOpenChange: (o: boolean) => void; onSave: (c: Client) => void }) {
  const empty: Client = { id: "", name: "", address: { line1: "", city: "", stateCode: "", country: "India" } }
  const [draft, setDraft] = React.useState<Client>(client ?? empty)
  const [error, setError] = React.useState<string | null>(null)
  const [lastKey, setLastKey] = React.useState<string | undefined>(undefined)
  const key = `${open}-${client?.id ?? "new"}`
  if (key !== lastKey) {
    setLastKey(key)
    setDraft(client ?? empty)
    setError(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{client ? "Edit client" : "New client"}</SheetTitle>
          <SheetDescription>{client ? "Updates the saved client everywhere." : "Saved to your clients and selected on this invoice."}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <PartyFields prefix="client" value={draft} onChange={(p) => setDraft({ ...draft, ...p })} />
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-9"
            onClick={() => {
              if (!draft.name.trim()) return setError("Add the client's name")
              if (draft.gstin && !RX.gstin.test(draft.gstin)) return setError("Client GSTIN looks invalid")
              if (!draft.address.stateCode) return setError("Choose the client's state")
              onSave({ ...draft, id: draft.id || uid("cl") })
            }}
          >
            Save client
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
