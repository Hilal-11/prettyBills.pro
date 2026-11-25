"use client"

import * as React from "react"
import { EraserIcon, PenLineIcon, StampIcon, Trash2Icon, Undo2Icon, UploadIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { LIMITS, SIGNATURE_FONTS } from "@/lib/invoice/config"
import type { Signature } from "@/lib/invoice/types"

import { Field, Segmented, TextField, ToggleRow } from "../fields"
import { GuestSaveHint } from "../account-dialog"
import { SectionCard } from "../section-card"
import type { EditorApi } from "../use-editor"

const DEFAULT_SIG: Signature = { show: true, kind: "draw", label: "Authorised Signatory", font: "dancing" }

export function SignatureSection({ ed }: { ed: EditorApi }) {
  const stored = ed.invoice.signature
  const sig = React.useMemo(() => stored ?? { ...DEFAULT_SIG, show: false }, [stored])
  const [saveProfile, setSaveProfile] = React.useState(false)
  const set = (patch: Partial<Signature>, key?: string) => ed.update((d) => void (d.signature = { ...DEFAULT_SIG, ...d.signature, ...patch }), key)

  const { saveDefaults } = ed
  React.useEffect(() => {
    if (saveProfile) saveDefaults({ signature: sig })
  }, [saveProfile, sig, saveDefaults])

  return (
    <SectionCard ed={ed} id="signature" icon={PenLineIcon} title="Signature" summary={sig.show ? [sig.signatoryName, sig.designation].filter(Boolean).join(", ") || "Shown" : "Hidden"}>
      <div className="rounded-lg border">
        <ToggleRow label="Show signature" checked={sig.show} onChange={(v) => set({ show: v })} />
      </div>

      {sig.show && (
        <>
          <Segmented
            label="Signature source"
            layoutId="sig-kind"
            value={sig.kind}
            options={[
              { value: "draw", label: "Draw" },
              { value: "type", label: "Type" },
              { value: "upload", label: "Upload" },
            ]}
            onChange={(k) => set({ kind: k, imageUrl: k === sig.kind ? sig.imageUrl : undefined })}
          />
          {ed.errorFor("signature.source") && <p className="text-xs text-destructive">{ed.errorFor("signature.source")}</p>}

          {sig.kind === "draw" && <SignaturePad value={sig.imageUrl} onChange={(url) => set({ imageUrl: url })} />}

          {sig.kind === "type" && (
            <div className="space-y-2">
              <Field label="Type your name">
                <TextField field="signature.typedName" value={sig.typedName} onChange={(v) => set({ typedName: v }, "sig.typed")} />
              </Field>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Signature style">
                {SIGNATURE_FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={sig.font === f.id}
                    onClick={() => set({ font: f.id })}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center rounded-lg border bg-white px-2 text-[#111] transition-[border-color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      sig.font === f.id ? "border-brand ring-2 ring-brand/30" : "hover:border-foreground/30"
                    )}
                  >
                    <span className="truncate text-xl leading-tight" style={{ fontFamily: f.cssVar }}>
                      {sig.typedName || "Rahul Mir"}
                    </span>
                    <span className="text-[10px] text-[#666]">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {sig.kind === "upload" && <SignatureUpload value={sig.imageUrl} onChange={(url) => set({ imageUrl: url })} />}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Signatory name">
              <TextField field="signature.signatoryName" value={sig.signatoryName} onChange={(v) => set({ signatoryName: v }, "sig.name")} />
            </Field>
            <Field label="Designation">
              <TextField field="signature.designation" placeholder="Proprietor" value={sig.designation} onChange={(v) => set({ designation: v }, "sig.designation")} />
            </Field>
            <Field label="Label" help={`Printed under "For ${ed.invoice.from.name || "your business"}"`} className="col-span-2">
              <TextField field="signature.label" value={sig.label} onChange={(v) => set({ label: v }, "sig.label")} />
            </Field>
          </div>

          <StampField value={sig.stampUrl} onChange={(url) => set({ stampUrl: url })} />

          {ed.guest ? (
            <div className="border-t border-dashed pt-3">
              <GuestSaveHint ed={ed}>to save your signature for next time</GuestSaveHint>
            </div>
          ) : (
            <label className="flex items-center gap-2 border-t border-dashed pt-3 text-[13px]">
              <Checkbox checked={saveProfile} onCheckedChange={(v) => setSaveProfile(!!v)} className="data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand" />
              Save signature to my profile
            </label>
          )}
        </>
      )}
    </SectionCard>
  )
}

/** Canvas pad. Exports a transparent PNG; the template inverts it on a black page. */
function SignaturePad({ value, onChange }: { value?: string; onChange: (url: string | undefined) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const strokes = React.useRef<{ x: number; y: number }[][]>([])
  const drawing = React.useRef(false)

  const redraw = React.useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext("2d")!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = 2.4 * (window.devicePixelRatio || 1)
    ctx.strokeStyle = "#111"
    for (const s of strokes.current) {
      ctx.beginPath()
      s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.stroke()
    }
  }, [])

  React.useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
    if (value && strokes.current.length === 0) {
      const img = new Image()
      img.onload = () => c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height)
      img.src = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- size once on mount
  }, [])

  const point = (e: React.PointerEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }

  const exportPng = () => onChange(strokes.current.length ? canvasRef.current?.toDataURL("image/png") : undefined)

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        aria-label="Signature pad. Draw with a mouse, pen or finger."
        className="h-32 w-full cursor-crosshair touch-none rounded-lg border bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = true
          strokes.current.push([point(e)])
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          strokes.current[strokes.current.length - 1].push(point(e))
          redraw()
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          exportPng()
        }}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            strokes.current.pop()
            redraw()
            exportPng()
          }}
        >
          <Undo2Icon /> Undo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            strokes.current = []
            redraw()
            onChange(undefined)
          }}
        >
          <EraserIcon /> Clear
        </Button>
      </div>
    </div>
  )
}

/** Reads an image and makes near-white pixels transparent. */
function removeWhite(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const max = 900
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement("canvas")
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      const ctx = c.getContext("2d")!
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const data = ctx.getImageData(0, 0, c.width, c.height)
      for (let i = 0; i < data.data.length; i += 4) {
        const [r, g, b] = [data.data[i], data.data[i + 1], data.data[i + 2]]
        const light = Math.min(r, g, b)
        if (light > 225) data.data[i + 3] = 0
        else if (light > 180) data.data[i + 3] = Math.round(((225 - light) / 45) * 255)
      }
      ctx.putImageData(data, 0, 0)
      resolve(c.toDataURL("image/png"))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function SignatureUpload({ value, onChange }: { value?: string; onChange: (url: string | undefined) => void }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (!f) return
          if (f.size > LIMITS.signatureBytes) return setError("Signature image must be 1 MB or smaller")
          setError(null)
          onChange(await removeWhite(f))
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
          <img src={value} alt="Uploaded signature" className="h-14 w-auto" />
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs text-[#444]" onClick={() => onChange(undefined)}>
            <Trash2Icon /> Remove
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="h-9 w-full border-dashed text-[13px]" onClick={() => ref.current?.click()}>
          <UploadIcon /> Upload PNG or JPG (white background is removed)
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function StampField({ value, onChange }: { value?: string; onChange: (url: string | undefined) => void }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  return (
    <Field label="Company stamp / seal" help="Optional. Placed next to the signature" error={error ?? undefined}>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (!f) return
          if (f.size > LIMITS.logoBytes) return setError("Stamp image must be 2 MB or smaller")
          setError(null)
          onChange(await removeWhite(f))
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
          <img src={value} alt="Stamp" className="h-12 w-auto" />
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs text-[#444]" onClick={() => onChange(undefined)}>
            <Trash2Icon /> Remove
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="h-9 justify-start text-[13px]" onClick={() => ref.current?.click()}>
          <StampIcon /> Upload stamp
        </Button>
      )}
    </Field>
  )
}
