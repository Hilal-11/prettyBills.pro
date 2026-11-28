"use client"

import * as React from "react"
import { motion } from "motion/react"
import { CheckIcon, Columns2Icon, EyeIcon, PanelLeftIcon, SlidersHorizontalIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useFont } from "@/hooks/use-font"
import { useTheme, type ThemeMode } from "@/hooks/use-theme"
import { setEditorView, type EditorView } from "@/lib/client/editor-events"
import { KEYS, readLocal, writeLocal } from "@/lib/client/local"
import type { PaymentDefaults, WorkspaceSettings } from "@/lib/data/types"
import { updateSettings } from "@/lib/client/workspace"
import type { Signature } from "@/lib/invoice/types"
import { Skeleton } from "@/components/ui/skeleton"
import { spring } from "@/lib/motion"
import { UI_FONTS } from "@/lib/theme"

import { GuestCard, Group, Row, SavedTick, TabHeader, useSavedFlash } from "./ui"
import { useSettings, type Account } from "./use-account"

export function PreferencesTab({ account }: { account: Account }) {
  return (
    <>
      <TabHeader title="Preferences" description="How PrettyBills looks and behaves on this device." />
      <Appearance />
      <FontPicker />
      <EditorLayout />
      {account.status === "user" ? (
        <InvoiceDefaultsLoader />
      ) : account.status === "guest" ? (
        <section>
          <h3 className="mb-2.5 text-[13px] font-semibold">Invoice defaults</h3>
          <GuestCard icon={SlidersHorizontalIcon} title="Reuse your terms, bank details and signature" body="Log in and the defaults you save in the editor fill in every new invoice." />
        </section>
      ) : null}
    </>
  )
}

/* ------------------------------ theme ------------------------------ */

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

function Appearance() {
  const { mode, setMode } = useTheme()
  return (
    <Group title="Appearance" description="System follows your device's light or dark setting.">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3 p-4">
        {THEMES.map((t) => {
          const on = mode === t.value
          return (
            <button key={t.value} type="button" role="radio" aria-checked={on} onClick={() => setMode(t.value)} className="group grid gap-2 text-left outline-none">
              <span
                className={cn(
                  "relative block overflow-hidden rounded-lg border-2 transition-[border-color,box-shadow] group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
                  on ? "border-brand shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_15%,transparent)]" : "border-border group-hover:border-foreground/25"
                )}
              >
                <ThemePreview mode={t.value} />
                {on && (
                  <motion.span layoutId="theme-check" transition={spring} className="absolute top-1.5 right-1.5 grid size-4.5 place-items-center rounded-full bg-brand text-white">
                    <CheckIcon className="size-3" />
                  </motion.span>
                )}
              </span>
              <span className={cn("text-xs", on ? "font-semibold" : "text-muted-foreground")}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </Group>
  )
}

/* ------------------------------- font ------------------------------- */

/** Interface font: each card is drawn in its own face. Applies at once, on this device. */
function FontPicker() {
  const { font, setFont } = useFont()
  return (
    <Group title="Font" description="The typeface for menus, tables and forms. Your invoices keep their template's type.">
      <div role="radiogroup" aria-label="Interface font" className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4">
        {UI_FONTS.map((f) => {
          const on = font === f.id
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setFont(f.id)}
              style={{ fontFamily: `${f.family}, ui-sans-serif, system-ui` }}
              className={cn(
                "relative grid gap-1 rounded-lg border-2 px-3 py-2.5 text-left transition-[border-color,box-shadow,background-color] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? "border-brand bg-brand/5 shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_15%,transparent)]" : "border-border hover:border-foreground/25 hover:bg-muted/40"
              )}
            >
              <span className="text-2xl leading-none font-medium">Aa</span>
              <span className={cn("mt-1 truncate text-[13px]", on ? "font-semibold" : "font-medium")}>{f.label}</span>
              <span className="text-[11px] text-muted-foreground">{f.kind}</span>
              {on && (
                <motion.span layoutId="font-check" transition={spring} className="absolute top-2 right-2 grid size-4.5 place-items-center rounded-full bg-brand text-white">
                  <CheckIcon className="size-3" />
                </motion.span>
              )}
            </button>
          )
        })}
      </div>
      {font !== "geist" && (
        <div className="flex justify-end border-t px-4 py-2">
          <Button variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setFont("geist")}>
            Reset to Geist
          </Button>
        </div>
      )}
    </Group>
  )
}

/** A tiny dashboard drawn in each theme's colours. */
function ThemePreview({ mode }: { mode: ThemeMode }) {
  const pane = (dark: boolean) => (
    <span className={cn("flex h-full gap-1 p-1.5", dark ? "bg-[#0a0a0a]" : "bg-[#f5f5f5]")}>
      <span className={cn("w-1/4 rounded-[3px]", dark ? "bg-[#1a1a1a]" : "bg-white")}>
        <span className="mx-1 mt-1.5 block h-1 rounded-full bg-[#0061ff]" />
        <span className={cn("mx-1 mt-1 block h-0.5 rounded-full", dark ? "bg-white/20" : "bg-black/15")} />
        <span className={cn("mx-1 mt-1 block h-0.5 rounded-full", dark ? "bg-white/20" : "bg-black/15")} />
      </span>
      <span className={cn("flex-1 rounded-[3px] p-1.5", dark ? "bg-[#161616]" : "bg-white")}>
        <span className={cn("block h-1 w-1/2 rounded-full", dark ? "bg-white/40" : "bg-black/30")} />
        <span className={cn("mt-1 block h-0.5 w-3/4 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
        <span className={cn("mt-0.5 block h-0.5 w-2/3 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
        <span className="mt-1.5 block h-1.5 w-1/3 rounded-[2px] bg-[#0061ff]" />
      </span>
    </span>
  )
  return (
    <span className="block aspect-[16/10] w-full">
      {mode === "system" ? (
        <span className="relative block h-full">
          <span className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]">{pane(false)}</span>
          <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">{pane(true)}</span>
        </span>
      ) : (
        pane(mode === "dark")
      )}
    </span>
  )
}

/* ------------------------------ editor ------------------------------ */

const VIEWS: { value: EditorView; label: string; icon: typeof EyeIcon }[] = [
  { value: "both", label: "Side by side", icon: Columns2Icon },
  { value: "form", label: "Form only", icon: PanelLeftIcon },
  { value: "preview", label: "Preview only", icon: EyeIcon },
]

function EditorLayout() {
  const [view, setView] = React.useState<EditorView>(() => readLocal<EditorView>(KEYS.view, "both"))
  return (
    <Group title="Invoice editor">
      <Row label="Layout" hint="How the form and live preview sit on wide screens. Alt 1, 2 and 3 switch it any time.">
        <div role="radiogroup" aria-label="Editor layout" className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          {VIEWS.map((v) => {
            const on = view === v.value
            return (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setView(v.value)
                  writeLocal(KEYS.view, v.value)
                  setEditorView(v.value)
                }}
                className={cn("relative isolate inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50", on ? "text-foreground" : "text-foreground/60 hover:text-foreground")}
              >
                {on && <motion.span layoutId="settings-view" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
                <v.icon className="size-3.5" />
                {v.label}
              </button>
            )
          })}
        </div>
      </Row>
    </Group>
  )
}

/* ------------------------------ defaults ------------------------------ */

function InvoiceDefaultsLoader() {
  const { status, settings } = useSettings(true)
  if (status === "loading") return <Skeleton className="h-56 w-full rounded-lg" />
  return <InvoiceDefaults initial={settings} />
}

function InvoiceDefaults({ initial }: { initial: WorkspaceSettings }) {
  const [terms, setTerms] = React.useState(initial.terms ?? "")
  const [savedTerms, setSavedTerms] = React.useState(terms)
  const [payment, setPayment] = React.useState<PaymentDefaults | null>(initial.payment)
  const [signature, setSignature] = React.useState<Signature | null>(initial.signature)
  const [termsShown, flashTerms] = useSavedFlash()
  const [error, setError] = React.useState<string | null>(null)

  async function saveTerms() {
    const value = terms.trim()
    try {
      await updateSettings({ terms: value || null })
    } catch (e) {
      return setError((e as Error).message)
    }
    setError(null)
    setSavedTerms(value)
    setTerms(value)
    flashTerms()
  }

  async function forget(key: "payment" | "signature", clear: () => void) {
    try {
      await updateSettings({ [key]: null })
      setError(null)
      clear()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const paymentSummary = payment
    ? [payment.upiId && `UPI ${payment.upiId}`, payment.bank?.accountNumber && `${payment.bank.bankName || "Bank"} ····${payment.bank.accountNumber.slice(-4)}`].filter(Boolean).join(" · ") || "Saved"
    : null
  const signatureSummary = signature ? signature.signatoryName || signature.typedName || (signature.kind === "draw" ? "Drawn signature" : "Uploaded signature") : null

  return (
    <Group title="Invoice defaults" description="Filled in on every new invoice, on any device. Save them from the editor with “save as default”, or change them here.">
      <div className="grid gap-2 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="settings-terms" className="text-[13px] font-medium">
            Terms &amp; conditions
          </label>
          <span className="flex items-center gap-2">
            <SavedTick show={termsShown} />
            <Button size="sm" className="h-7 min-w-14 text-xs" disabled={terms.trim() === savedTerms} onClick={saveTerms}>
              Save
            </Button>
          </span>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Textarea id="settings-terms" value={terms} maxLength={2000} placeholder="e.g. Payment due within 15 days. Interest at 18% p.a. on late payments." onChange={(e) => setTerms(e.target.value)} className="min-h-20 resize-y bg-background text-[13px] md:text-[13px]" />
      </div>
      <Row label="Payment details" hint={paymentSummary ?? "None saved. Tick “save as default” in the Payment section of an invoice."}>
        {payment && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => forget("payment", () => setPayment(null))}>
            Forget
          </Button>
        )}
      </Row>
      <Row
        label="Signature"
        hint={
          signature ? (
            <span className="inline-flex items-center gap-2">
              {signature.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- data URL from the editor
                <img src={signature.imageUrl} alt="" className="h-6 max-w-24 rounded border bg-white object-contain px-1" />
              )}
              {signatureSummary}
            </span>
          ) : (
            "None saved. Add one in the Signature section of an invoice."
          )
        }
      >
        {signature && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => forget("signature", () => setSignature(null))}>
            Forget
          </Button>
        )}
      </Row>
    </Group>
  )
}
