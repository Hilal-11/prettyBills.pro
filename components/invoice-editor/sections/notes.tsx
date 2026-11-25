"use client"

import * as React from "react"
import { StickyNoteIcon } from "lucide-react"
import { cn } from "cn"

import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { LIMITS } from "@/lib/invoice/config"
import { SAVED_TERMS } from "@/lib/invoice/defaults"

import { Field, SelectField, TextField } from "../fields"
import { GuestSaveHint } from "../account-dialog"
import { SectionCard } from "../section-card"
import type { EditorApi } from "../use-editor"

export function NotesSection({ ed }: { ed: EditorApi }) {
  const inv = ed.invoice
  const [saveTerms, setSaveTerms] = React.useState(false)
  const savedDefault = ed.guest ? null : ed.defaults.terms
  const { saveDefaults } = ed
  React.useEffect(() => {
    if (saveTerms && inv.terms) saveDefaults({ terms: inv.terms })
  }, [saveTerms, inv.terms, saveDefaults])

  const termsOptions = [
    { value: "", label: "Use saved terms…" },
    ...(savedDefault ? [{ value: "__default", label: "My default terms" }] : []),
    ...SAVED_TERMS.map((t) => ({ value: t.id, label: t.label })),
  ]
  const notesLen = inv.notes?.length ?? 0

  return (
    <SectionCard ed={ed} id="notes" icon={StickyNoteIcon} title="Notes & terms" summary={inv.notes ? inv.notes.slice(0, 60) : "No notes"}>
      <Field
        label="Notes to client"
        error={ed.validation.errors.notes}
        aside={<span className={cn("text-xs tabular-nums", notesLen > LIMITS.notesChars ? "text-destructive" : "text-foreground/60")}>{notesLen}/{LIMITS.notesChars}</span>}
      >
        <Textarea
          data-field="notes"
          rows={3}
          value={inv.notes ?? ""}
          placeholder="Thanks for the quick approvals."
          onChange={(e) => ed.update((d) => void (d.notes = e.target.value), "notes")}
          className="min-h-20 resize-y text-sm md:text-sm"
        />
      </Field>

      <Field
        label="Terms & conditions"
        help="One per line; numbered lists are fine"
        aside={
          <SelectField
            field="termsPreset"
            value=""
            options={termsOptions}
            className="h-7 w-auto text-xs"
            onChange={(v) => {
              const text = v === "__default" ? savedDefault : SAVED_TERMS.find((t) => t.id === v)?.text
              if (text) ed.update((d) => void (d.terms = text))
            }}
          />
        }
      >
        <Textarea data-field="terms" rows={4} value={inv.terms ?? ""} onChange={(e) => ed.update((d) => void (d.terms = e.target.value), "terms")} className="min-h-24 resize-y text-sm md:text-sm" />
      </Field>
      {ed.guest ? (
        <GuestSaveHint ed={ed}>to save these as your default terms</GuestSaveHint>
      ) : (
        <label className="flex items-center gap-2 text-[13px]">
          <Checkbox checked={saveTerms} onCheckedChange={(v) => setSaveTerms(!!v)} className="data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand" />
          Save as my default terms
        </label>
      )}

      <Field label="Footer text" help="One line at the bottom of every page">
        <TextField field="footer" maxLength={140} value={inv.footer} onChange={(v) => ed.update((d) => void (d.footer = v), "footer")} />
      </Field>
    </SectionCard>
  )
}
