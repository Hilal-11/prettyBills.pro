"use client"

import * as React from "react"
import { EllipsisIcon, PaperclipIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { LIMITS } from "@/lib/invoice/config"
import { uid } from "@/lib/invoice/format"

import { Field, Segmented, SelectField, TextField } from "../fields"
import { SectionCard } from "../section-card"
import type { EditorApi } from "../use-editor"

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

export function MoreSection({ ed }: { ed: EditorApi }) {
  const inv = ed.invoice
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  const used = inv.attachments.reduce((s, a) => s + a.size, 0)

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    const total = used + list.reduce((s, f) => s + f.size, 0)
    if (total > LIMITS.attachmentsBytes) return setError("Attachments are limited to 10 MB in total")
    if (list.some((f) => !/^(application\/pdf|image\/)/.test(f.type))) return setError("Attach PDFs or images")
    setError(null)
    const read = await Promise.all(
      list.map(
        (f) =>
          new Promise<{ id: string; name: string; url: string; size: number }>((resolve) => {
            const r = new FileReader()
            r.onload = () => resolve({ id: uid("att"), name: f.name, url: String(r.result), size: f.size })
            r.readAsDataURL(f)
          })
      )
    )
    ed.update((d) => void d.attachments.push(...read))
  }

  return (
    <SectionCard ed={ed} id="more" icon={EllipsisIcon} title="More" summary={[inv.customFields.length && `${inv.customFields.length} custom fields`, inv.attachments.length && `${inv.attachments.length} attachments`].filter(Boolean).join(" · ") || "Custom fields, attachments, format"}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-foreground/90">Custom fields</p>
          <span className="text-xs text-foreground/60">
            {inv.customFields.length}/{LIMITS.customFields}
          </span>
        </div>
        <p className="text-xs text-foreground/65">Printed in the invoice header, e.g. Project: Menu redesign</p>
        {inv.customFields.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_1.4fr_auto] items-start gap-2">
            <TextField field={`customFields.${c.id}.label`} placeholder="Label" aria-label="Field label" value={c.label} error={ed.validation.errors[`customFields.${c.id}.label`]} onChange={(v) => ed.update((d) => void (d.customFields.find((x) => x.id === c.id)!.label = v), `cf.${c.id}.l`)} />
            <TextField field={`customFields.${c.id}.value`} placeholder="Value" aria-label="Field value" value={c.value} onChange={(v) => ed.update((d) => void (d.customFields.find((x) => x.id === c.id)!.value = v), `cf.${c.id}.v`)} />
            <Button variant="ghost" size="icon-sm" aria-label="Remove field" className="mt-1 text-foreground/60 hover:text-destructive" onClick={() => ed.update((d) => void (d.customFields = d.customFields.filter((x) => x.id !== c.id)))}>
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={inv.customFields.length >= LIMITS.customFields}
          onClick={() => ed.update((d) => void d.customFields.push({ id: uid("cf"), label: "", value: "" }))}
        >
          <PlusIcon /> Add field
        </Button>
      </div>

      <Field label="Attachments" help={`Sent with the email and share page, not printed · ${kb(used)} of 10 MB`} error={error ?? ed.validation.errors.attachments}>
        <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => void addFiles(e.target.files).finally(() => (e.target.value = ""))} />
        {inv.attachments.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {inv.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                <PaperclipIcon className="size-3.5 shrink-0 text-foreground/60" />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="text-xs text-foreground/60 tabular-nums">{kb(a.size)}</span>
                <Button variant="ghost" size="icon-xs" aria-label={`Remove ${a.name}`} onClick={() => ed.update((d) => void (d.attachments = d.attachments.filter((x) => x.id !== a.id)))}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" className="h-9 justify-start border-dashed text-[13px]" onClick={() => fileRef.current?.click()}>
          <PaperclipIcon /> Attach files
        </Button>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Invoice language" help="More languages later">
          <SelectField field="language" value={inv.language} options={[{ value: "en", label: "English" }]} onChange={() => {}} />
        </Field>
        <Field label="Date format">
          <Segmented
            label="Date format"
            layoutId="date-format"
            value={inv.dateFormat}
            options={[
              { value: "DD MMM YYYY", label: "01 Nov 2026" },
              { value: "DD/MM/YYYY", label: "01/11/2026" },
            ]}
            onChange={(v) => ed.update((d) => void (d.dateFormat = v))}
          />
        </Field>
      </div>

      <Field label="Internal note" help="Private. Never printed or shared">
        <Textarea data-field="internalNote" rows={2} value={inv.internalNote ?? ""} onChange={(e) => ed.update((d) => void (d.internalNote = e.target.value), "internalNote")} className="min-h-16 resize-y bg-brand/5 text-sm md:text-sm" />
      </Field>
    </SectionCard>
  )
}
