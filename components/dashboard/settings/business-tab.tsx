"use client"

import * as React from "react"
import { Building2Icon, LoaderCircleIcon, LockIcon } from "lucide-react"
import { cn } from "cn"

import { Combobox } from "@/components/invoice-editor/fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { applyBusinessToEditor } from "@/lib/client/editor-events"
import { updateSettings } from "@/lib/client/workspace"
import { STATES, stateLabel } from "@/lib/invoice/config"
import type { BusinessSnapshot } from "@/lib/invoice/types"
import { panFromGstin, RX } from "@/lib/invoice/validate"

import { GuestCard, Group, SavedTick, TabHeader, useSavedFlash } from "./ui"
import { useSettings, type Account } from "./use-account"

type Business = BusinessSnapshot & { id?: string }

const EMPTY: Business = { name: "", legalName: "", gstin: "", pan: "", address: { line1: "", line2: "", city: "", pin: "", stateCode: "", country: "India" }, email: "", phone: "", website: "" }
const stateOptions = STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})`, keywords: [s.code] }))

function validate(b: Business) {
  const e: Partial<Record<string, string>> = {}
  if (!b.name.trim()) e.name = "Enter your business name"
  if (b.gstin && !RX.gstin.test(b.gstin)) e.gstin = "GSTIN is 15 characters, like 01ABCDE1234F1Z5"
  if (b.pan && !RX.pan.test(b.pan)) e.pan = "PAN is 10 characters, like ABCDE1234F"
  if (b.address.pin && !RX.pin.test(b.address.pin)) e.pin = "PIN code is 6 digits"
  if (b.email && !RX.email.test(b.email)) e.email = "Check the email address"
  if (b.phone && !RX.phone.test(b.phone)) e.phone = "Check the phone number"
  return e
}

export function BusinessTab({ account }: { account: Account }) {
  if (account.status === "loading") return <BusinessSkeleton />
  if (account.status === "guest")
    return (
      <>
        <TabHeader title="Business details" description="The details printed at the top of every invoice." />
        <GuestCard icon={Building2Icon} title="Save your business details once" body="Log in and every new invoice starts with your name, GSTIN, address and logo already filled in." />
      </>
    )
  return <BusinessLoader />
}

function BusinessSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading business details">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="mt-2 h-3.5 w-72" />
      <Skeleton className="mt-6 h-44 w-full rounded-lg" />
      <Skeleton className="mt-6 h-52 w-full rounded-lg" />
    </div>
  )
}

function BusinessLoader() {
  const { status, settings, patch } = useSettings(true)
  if (status === "loading") return <BusinessSkeleton />
  return <BusinessForm initial={settings.business} loadFailed={status === "error"} onSaved={(business) => patch({ business })} />
}

function BusinessForm({ initial, loadFailed, onSaved }: { initial: Business | null; loadFailed: boolean; onSaved: (b: Business) => void }) {
  // the saved default, not the open invoice
  const [saved, setSaved] = React.useState<Business | null>(initial)
  const [saveError, setSaveError] = React.useState<string | null>(loadFailed ? "Couldn't load your saved details. Saving will replace them." : null)
  const [b, setB] = React.useState<Business>(() => ({ ...EMPTY, ...saved, address: { ...EMPTY.address, ...saved?.address } }))
  const [applyNow, setApplyNow] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [shown, flash] = useSavedFlash()

  const errors = tried ? validate(b) : {}
  const gstinValid = !!b.gstin && RX.gstin.test(b.gstin)
  const dirty = JSON.stringify(b) !== JSON.stringify({ ...EMPTY, ...saved, address: { ...EMPTY.address, ...saved?.address } })

  const set = (patch: Partial<Business>) => setB((x) => ({ ...x, ...patch }))
  const setAddr = (patch: Partial<Business["address"]>) => setB((x) => ({ ...x, address: { ...x.address, ...patch } }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (Object.keys(validate(b)).length) return
    setPending(true)
    setSaveError(null)
    // keep the logo set in the editor
    const next: Business = { ...saved, ...b, id: saved?.id ?? b.id ?? "default", name: b.name.trim() }
    try {
      await updateSettings({ business: next })
    } catch (error) {
      setPending(false)
      return setSaveError((error as Error).message)
    }
    if (applyNow) {
      const snapshot: Business = { ...next }
      delete snapshot.id
      applyBusinessToEditor(snapshot)
    }
    setSaved(next)
    onSaved(next)
    setPending(false)
    setTried(false)
    flash()
  }

  return (
    <form onSubmit={save} noValidate>
      <TabHeader title="Business details" description="New invoices start with these. Saved to your account." />
      {saveError && <p className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{saveError}</p>}

      {!saved && (
        <p className="mb-4 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          Nothing saved yet. Fill this in once and every new invoice starts with it, or tick “Save changes to my business profile” in the editor.
        </p>
      )}

      <Group title="Business">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <F label="Business name" required error={errors.name} className="sm:col-span-2">
            <Input value={b.name} maxLength={100} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name || undefined} className={ctl} />
          </F>
          <F label="Legal name" hint="Printed under the business name if it's different" className="sm:col-span-2">
            <Input value={b.legalName ?? ""} maxLength={120} onChange={(e) => set({ legalName: e.target.value })} className={ctl} />
          </F>
          <F label="GSTIN" error={errors.gstin} hint={gstinValid ? `State set to ${stateLabel(b.gstin!.slice(0, 2))}` : "Sets your state and PAN"}>
            <Input
              value={b.gstin ?? ""}
              maxLength={15}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/\s/g, "")
                if (RX.gstin.test(v)) setB((x) => ({ ...x, gstin: v, pan: panFromGstin(v), address: { ...x.address, stateCode: v.slice(0, 2) } }))
                else set({ gstin: v })
              }}
              aria-invalid={!!errors.gstin || undefined}
              className={cn(ctl, "uppercase")}
            />
          </F>
          <F label="PAN" error={errors.pan}>
            <Input value={b.pan ?? ""} maxLength={10} onChange={(e) => set({ pan: e.target.value.toUpperCase() })} aria-invalid={!!errors.pan || undefined} className={cn(ctl, "uppercase")} />
          </F>
        </div>
      </Group>

      <Group title="Address">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <F label="Address line 1" className="sm:col-span-2">
            <Input value={b.address.line1} onChange={(e) => setAddr({ line1: e.target.value })} className={ctl} />
          </F>
          <F label="Address line 2" className="sm:col-span-2">
            <Input value={b.address.line2 ?? ""} onChange={(e) => setAddr({ line2: e.target.value })} className={ctl} />
          </F>
          <F label="City">
            <Input value={b.address.city} onChange={(e) => setAddr({ city: e.target.value })} className={ctl} />
          </F>
          <F label="PIN code" error={errors.pin}>
            <Input value={b.address.pin ?? ""} inputMode="numeric" maxLength={6} onChange={(e) => setAddr({ pin: e.target.value.replace(/\D/g, "") })} aria-invalid={!!errors.pin || undefined} className={ctl} />
          </F>
          <F
            label="State"
            className="sm:col-span-2"
            aside={gstinValid ? <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><LockIcon className="size-3" /> From GSTIN</span> : null}
          >
            <Combobox
              field="settings.business.state"
              value={b.address.stateCode}
              options={stateOptions}
              disabled={gstinValid}
              placeholder="Choose state"
              searchPlaceholder="Search states or codes"
              onChange={(v) => setAddr({ stateCode: v })}
            />
          </F>
        </div>
      </Group>

      <Group
        title="Contact"
        footer={
          <>
            <label className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={applyNow} onCheckedChange={(v) => setApplyNow(!!v)} className="data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand" />
              Also update the invoice I&apos;m editing
            </label>
            <SavedTick show={shown} />
            <Button type="submit" size="sm" className="h-8 min-w-16 text-xs" disabled={pending || (!dirty && !!saved)}>
              {pending ? <LoaderCircleIcon className="animate-spin" /> : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <F label="Email" error={errors.email}>
            <Input type="email" value={b.email ?? ""} onChange={(e) => set({ email: e.target.value })} aria-invalid={!!errors.email || undefined} className={ctl} />
          </F>
          <F label="Phone" error={errors.phone}>
            <Input type="tel" placeholder="+91 " value={b.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} aria-invalid={!!errors.phone || undefined} className={ctl} />
          </F>
          <F label="Website" className="sm:col-span-2">
            <Input placeholder="yourbusiness.in" value={b.website ?? ""} onChange={(e) => set({ website: e.target.value })} className={ctl} />
          </F>
        </div>
      </Group>
      <p className="mt-3 text-[11px] text-muted-foreground">Your logo is set from the Business section of the invoice editor.</p>
    </form>
  )
}

const ctl = "h-9 bg-background text-[13px] md:text-[13px]"

/** Label above, hint or error below. The label is tied to the input inside. */
function F({ label, required, error, hint, aside, className, children }: { label: string; required?: boolean; error?: string; hint?: string; aside?: React.ReactNode; className?: string; children: React.ReactElement<{ id?: string; "aria-describedby"?: string }> }) {
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
        <p id={`${id}-note`} className="text-[11px] text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-note`} className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
