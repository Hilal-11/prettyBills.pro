"use client"

import * as React from "react"
import { Building2Icon, ImageUpIcon, LockIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { useDashboardUI } from "@/components/dashboard/dashboard-ui"
import { Checkbox } from "@/components/ui/checkbox"
import { LIMITS, STATES, stateLabel } from "@/lib/invoice/config"
import { panFromGstin, RX } from "@/lib/invoice/validate"

import { Combobox, Field, Segmented, SelectField, TextField, ToggleRow } from "../fields"
import { GuestSaveHint } from "../account-dialog"
import { SectionCard } from "../section-card"
import type { EditorApi } from "../use-editor"

const COUNTRIES = ["India", "United Arab Emirates", "United States", "United Kingdom", "Singapore"].map((c) => ({ value: c, label: c }))
const stateOptions = STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})`, keywords: [s.code] }))

export function BusinessSection({ ed }: { ed: EditorApi }) {
  const f = ed.invoice.from
  const [saveProfile, setSaveProfile] = React.useState(false)
  const ui = useDashboardUI()
  const gstinValid = !!f.gstin && RX.gstin.test(f.gstin)

  const { saveDefaults } = ed
  React.useEffect(() => {
    if (saveProfile) saveDefaults({ business: { ...f, id: ed.invoice.businessId } })
  }, [saveProfile, f, ed.invoice.businessId, saveDefaults])

  const set = (key: string, recipe: (d: typeof ed.invoice) => void) => ed.update(recipe, key)
  const err = (p: string) => ed.errorFor(p)

  return (
    <SectionCard ed={ed} id="business" icon={Building2Icon} title="Business" summary={[f.name, f.address.city].filter(Boolean).join(" · ")}>
      <LogoField ed={ed} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Business name" required error={err("from.name")} htmlFor="f-from-name" className="col-span-2">
          <TextField field="from.name" maxLength={100} value={f.name} error={err("from.name")} onBlur={() => ed.touch("from.name")} onChange={(v) => set("from.name", (d) => void (d.from.name = v))} />
        </Field>
        <Field label="Legal name" help="Printed under the business name if it's different" htmlFor="f-from-legalName" className="col-span-2">
          <TextField field="from.legalName" value={f.legalName} onChange={(v) => set("from.legalName", (d) => void (d.from.legalName = v))} />
        </Field>
        <Field label="GSTIN" error={err("from.gstin")} htmlFor="f-from-gstin" help={gstinValid ? `State set to ${stateLabel(f.gstin!.slice(0, 2))}` : "15 characters. Sets your state and PAN"}>
          <TextField
            field="from.gstin"
            upper
            maxLength={15}
            value={f.gstin}
            error={err("from.gstin")}
            onBlur={() => ed.touch("from.gstin")}
            onChange={(v) =>
              set("from.gstin", (d) => {
                d.from.gstin = v
                if (RX.gstin.test(v)) {
                  d.from.address.stateCode = v.slice(0, 2)
                  d.from.pan = panFromGstin(v)
                  if (d.title === "Bill of Supply") d.title = "Tax Invoice"
                }
              })
            }
          />
        </Field>
        <Field label="PAN" error={err("from.pan")} htmlFor="f-from-pan">
          <TextField field="from.pan" upper maxLength={10} value={f.pan} error={err("from.pan")} onBlur={() => ed.touch("from.pan")} onChange={(v) => set("from.pan", (d) => void (d.from.pan = v))} />
        </Field>
        <Field label="Address line 1" required error={err("from.address.line1")} htmlFor="f-from-address-line1" className="col-span-2">
          <TextField field="from.address.line1" value={f.address.line1} error={err("from.address.line1")} onBlur={() => ed.touch("from.address.line1")} onChange={(v) => set("from.address.line1", (d) => void (d.from.address.line1 = v))} />
        </Field>
        <Field label="Address line 2" htmlFor="f-from-address-line2" className="col-span-2">
          <TextField field="from.address.line2" value={f.address.line2} onChange={(v) => set("from.address.line2", (d) => void (d.from.address.line2 = v))} />
        </Field>
        <Field label="City" required error={err("from.address.city")} htmlFor="f-from-address-city">
          <TextField field="from.address.city" value={f.address.city} error={err("from.address.city")} onBlur={() => ed.touch("from.address.city")} onChange={(v) => set("from.address.city", (d) => void (d.from.address.city = v))} />
        </Field>
        <Field label="PIN code" error={err("from.address.pin")} htmlFor="f-from-address-pin">
          <TextField
            field="from.address.pin"
            inputMode="numeric"
            maxLength={6}
            value={f.address.pin}
            error={err("from.address.pin")}
            onBlur={() => ed.touch("from.address.pin")}
            onChange={(v) => set("from.address.pin", (d) => void (d.from.address.pin = v.replace(/\D/g, "")))}
          />
        </Field>
        <Field
          label="State"
          required
          error={err("from.address.stateCode")}
          className="col-span-2"
          aside={gstinValid ? <span className="inline-flex items-center gap-1 text-xs text-foreground/65"><LockIcon className="size-3" /> From GSTIN</span> : null}
        >
          <Combobox
            field="from.address.stateCode"
            value={f.address.stateCode}
            options={stateOptions}
            disabled={gstinValid}
            placeholder="Choose state"
            searchPlaceholder="Search states or codes"
            onChange={(v) => set("from.address.stateCode", (d) => void (d.from.address.stateCode = v))}
          />
        </Field>
        <Field label="Country" className="col-span-2">
          <SelectField field="from.address.country" value={f.address.country} options={COUNTRIES} onChange={(v) => set("from.address.country", (d) => void (d.from.address.country = v))} />
        </Field>
        <Field label="Email" error={err("from.email")} htmlFor="f-from-email">
          <TextField field="from.email" type="email" value={f.email} error={err("from.email")} onBlur={() => ed.touch("from.email")} onChange={(v) => set("from.email", (d) => void (d.from.email = v))} />
        </Field>
        <Field label="Phone" error={err("from.phone")} htmlFor="f-from-phone">
          <TextField field="from.phone" type="tel" placeholder="+91 " value={f.phone} error={err("from.phone")} onBlur={() => ed.touch("from.phone")} onChange={(v) => set("from.phone", (d) => void (d.from.phone = v))} />
        </Field>
        <Field label="Website" error={err("from.website")} htmlFor="f-from-website" className="col-span-2">
          <TextField field="from.website" placeholder="yourbusiness.in" value={f.website} error={err("from.website")} onBlur={() => ed.touch("from.website")} onChange={(v) => set("from.website", (d) => void (d.from.website = v))} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3">
        {ed.guest ? (
          <GuestSaveHint ed={ed}>to save your business details for next time</GuestSaveHint>
        ) : (
          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox checked={saveProfile} onCheckedChange={(v) => setSaveProfile(!!v)} className="data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand" />
            Save changes to my business profile
          </label>
        )}
        <button type="button" onClick={() => ui.openSettings("business")} className="text-xs font-medium text-brand hover:underline dark:text-[#6da2ff]">
          Manage business details →
        </button>
      </div>
    </SectionCard>
  )
}

function LogoField({ ed }: { ed: EditorApi }) {
  const logo = ed.invoice.from.logo
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const black = ed.invoice.pageColor === "black"

  function accept(file: File | undefined) {
    if (!file) return
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) return setError("Use a PNG, JPG, SVG or WebP image")
    if (file.size > LIMITS.logoBytes) return setError("Logo must be 2 MB or smaller")
    setError(null)
    const reader = new FileReader()
    reader.onload = () =>
      ed.update((d) => {
        d.from.logo = { url: String(reader.result), size: d.from.logo?.size ?? "m", position: d.from.logo?.position ?? "right", lightTile: d.from.logo?.lightTile ?? true }
      })
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium text-foreground/90">Logo</p>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
      {logo ? (
        <div className="flex items-center gap-3 rounded-lg border p-2.5">
          <span className={cn("grid size-14 shrink-0 place-items-center rounded-md border", black && logo.lightTile ? "bg-white" : "bg-muted/40")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={logo.url} alt="Logo preview" className="max-h-11 max-w-12 object-contain" />
          </span>
          <div className="flex flex-1 flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => inputRef.current?.click()}>
              <ImageUpIcon /> Replace
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-foreground/70 hover:text-destructive" onClick={() => ed.update((d) => void (d.from.logo = undefined))}>
              <Trash2Icon /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            accept(e.dataTransfer.files?.[0])
          }}
          className={cn(
            "flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            dragging ? "border-brand bg-brand/5" : "hover:bg-muted/40"
          )}
        >
          <ImageUpIcon className="size-5 text-foreground/60" />
          <span className="text-[13px] font-medium">Drop your logo or click to upload</span>
          <span className="text-xs text-foreground/65">PNG, JPG, SVG or WebP · up to 2 MB</span>
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {logo && (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Logo size"
            layoutId="logo-size"
            value={logo.size}
            options={[
              { value: "s", label: "S" },
              { value: "m", label: "M" },
              { value: "l", label: "L" },
            ]}
            onChange={(v) => ed.update((d) => void (d.from.logo && (d.from.logo.size = v)))}
          />
          <Segmented
            label="Logo position"
            layoutId="logo-pos"
            value={logo.position}
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
            onChange={(v) => ed.update((d) => void (d.from.logo && (d.from.logo.position = v)))}
          />
        </div>
      )}
      {logo && black && (
        <div className="rounded-lg border">
          <ToggleRow label="Show on light tile" hint="Keeps dark logos visible on a black page" checked={logo.lightTile} onChange={(v) => ed.update((d) => void (d.from.logo && (d.from.logo.lightTile = v)))} />
        </div>
      )}
    </div>
  )
}
