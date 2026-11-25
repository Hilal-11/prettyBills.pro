"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CircleAlertIcon, CircleCheckIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon, MailIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ease } from "@/lib/motion"

const noop = () => () => {}

/**
 * One query-string value, read without useSearchParams (which would need a
 * Suspense boundary). Server render and hydration see null; the client then
 * re-renders with the real value.
 */
export function useSearchParam(name: string) {
  return React.useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get(name),
    () => null
  )
}

export const control = "h-9 bg-background text-[13px] md:text-[13px]"

export function Field({ id, label, error, aside, children }: { id: string; label: string; error?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs text-foreground/80">
          {label}
        </label>
        {aside}
      </div>
      {children}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${id}-error`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease }}
            className="text-[11px] text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

export function PasswordInput({ id, error, className, ...props }: Omit<React.ComponentProps<typeof Input>, "type"> & { id: string; error?: string }) {
  const [show, setShow] = React.useState(false)
  return (
    <div className="relative">
      <Input id={id} name={id} type={show ? "text" : "password"} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : undefined} className={cn(control, "pr-9", className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={show ? "hide" : "show"}
            initial={{ opacity: 0, scale: 0.6, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: 45 }}
            transition={{ duration: 0.18 }}
          >
            {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  )
}

/** 0–4 score: length, mixed case, digits, symbols. Guidance only; the server has the final say. */
export function passwordScore(pw: string) {
  if (!pw) return 0
  let s = pw.length >= 8 ? 1 : 0
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(4, s)
}

const strength = ["Too short", "Weak", "Okay", "Good", "Strong"]

export function PasswordMeter({ value }: { value: string }) {
  const score = passwordScore(value)
  return (
    <AnimatePresence initial={false}>
      {value && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }} className="overflow-hidden">
          <div className="flex items-center gap-2 pt-0.5" aria-live="polite">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.span
                    className={cn("block h-full rounded-full", score <= 1 ? "bg-destructive" : "bg-linear-to-r from-brand to-brand-deep")}
                    initial={false}
                    animate={{ width: score >= i ? "100%" : "0%" }}
                    transition={{ duration: 0.25, ease }}
                  />
                </span>
              ))}
            </div>
            <span className="w-14 text-right text-[11px] text-muted-foreground">{strength[score]}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Inline message under a form: error (red) or success (brand blue). */
export function FormAlert({ tone = "error", children }: { tone?: "error" | "success"; children?: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.div
          role={tone === "error" ? "alert" : "status"}
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease }}
          className="overflow-hidden"
        >
          <p
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
              tone === "error" ? "border-destructive/25 bg-destructive/5 text-destructive" : "border-brand/25 bg-brand/5 text-brand-deep dark:text-[#8fb5ff]"
            )}
          >
            {tone === "error" ? <CircleAlertIcon className="mt-px size-3.5 shrink-0" /> : <CircleCheckIcon className="mt-px size-3.5 shrink-0" />}
            <span>{children}</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function SubmitButton({ pending, children, pendingText }: { pending: boolean; children: React.ReactNode; pendingText: string }) {
  return (
    <Button type="submit" disabled={pending} className="mt-1 h-9 w-full text-[13px] active:scale-[0.98]">
      {pending && <LoaderCircleIcon className="animate-spin" />}
      {pending ? pendingText : children}
    </Button>
  )
}

/** Webmail shortcut for the most common providers, so "check your inbox" is one click. */
function inboxFor(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? ""
  if (domain === "gmail.com" || domain === "googlemail.com") return { label: "Open Gmail", href: "https://mail.google.com/mail/u/0/#inbox" }
  if (/^(outlook|hotmail|live|msn)\./.test(domain)) return { label: "Open Outlook", href: "https://outlook.live.com/mail/" }
  if (/^(yahoo|ymail)\./.test(domain)) return { label: "Open Yahoo Mail", href: "https://mail.yahoo.com/" }
  if (domain === "icloud.com" || domain === "me.com") return { label: "Open iCloud Mail", href: "https://www.icloud.com/mail" }
  return null
}

/**
 * "Check your inbox" panel with a resend button on a 60 s cooldown.
 * `onResend` returns an error message, or null when the email went out.
 */
export function CheckEmail({ email, title, body, onResend, onBack, backText = "Use a different email" }: { email: string; title: string; body: React.ReactNode; onResend?: () => Promise<string | null>; onBack: () => void; backText?: string }) {
  const [cooldown, setCooldown] = React.useState(60)
  const [state, setState] = React.useState<{ pending: boolean; error?: string; sent?: boolean }>({ pending: false })
  const inbox = inboxFor(email)

  React.useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function resend() {
    if (!onResend) return
    setState({ pending: true })
    const error = await onResend()
    setState({ pending: false, error: error ?? undefined, sent: !error })
    if (!error) setCooldown(60)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.4, ease }} className="mx-auto flex w-full max-w-85 flex-col items-center text-center">
      <motion.span
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.45, duration: 0.6, delay: 0.05 }}
        className="relative grid size-12 place-items-center rounded-xl bg-linear-to-b from-brand to-brand-deep text-white shadow-[0_3px_0_var(--brand-shadow)]"
      >
        <MailIcon className="size-5" />
        <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-background bg-brand">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/70" />
        </span>
      </motion.span>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
      <div className="mt-2 text-[13px] text-muted-foreground">{body}</div>
      <p className="mt-3 rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground">{email}</p>

      <div className="mt-6 grid w-full gap-2">
        {inbox && (
          <a href={inbox.href} target="_blank" rel="noreferrer" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background text-[13px] shadow-xs transition-[background-color,scale] hover:bg-muted/60 active:scale-[0.98]">
            <MailIcon className="size-4" /> {inbox.label}
          </a>
        )}
        {onResend && (
          <Button type="button" variant="ghost" disabled={cooldown > 0 || state.pending} onClick={resend} className="h-9 w-full text-[13px]">
            {state.pending && <LoaderCircleIcon className="animate-spin" />}
            {cooldown > 0 ? `Resend email in ${cooldown}s` : state.pending ? "Sending…" : "Resend email"}
          </Button>
        )}
      </div>
      <div className="mt-2 w-full text-left">
        <FormAlert>{state.error}</FormAlert>
        <FormAlert tone="success">{state.sent && cooldown > 50 ? "Sent. It can take a minute to arrive, so check spam too." : undefined}</FormAlert>
      </div>

      <button type="button" onClick={onBack} className="mt-6 text-xs font-semibold text-foreground underline-offset-4 hover:underline">
        {backText}
      </button>
    </motion.div>
  )
}
