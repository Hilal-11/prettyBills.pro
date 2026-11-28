"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { LoaderCircleIcon, LogInIcon, UserPlusIcon } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { z } from "zod"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { CALLBACK_ERRORS, authMessage } from "@/lib/auth/messages"
import { safeNext } from "@/lib/auth/redirect"
import { ease, rise, spring, stagger } from "@/lib/motion"
import { createClient } from "@/lib/supabase/client"

import { CheckEmail, Field, FormAlert, PasswordInput, PasswordMeter, SubmitButton, control, useSearchParam } from "./auth-ui"

export type Mode = "login" | "signup"

const copy = {
  login: {
    title: "Welcome back",
    subtitle: "Log in to send, track and get paid on your invoices.",
    submit: "Log in",
    pending: "Logging in…",
    switchText: "Don't have an account?",
    switchCta: "Sign up",
  },
  signup: {
    title: "Create your account",
    subtitle: "Save your invoices, send them and get paid. Free forever.",
    submit: "Create account",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchCta: "Log in",
  },
} as const

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120, "Keep it under 120 characters").optional(),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
})

type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>
type Sent = { email: string; reason: "signup" | "unconfirmed" }

/** Read on demand rather than with useSearchParams, so the page needs no Suspense boundary. */
const nextParam = () => safeNext(new URLSearchParams(window.location.search).get("next"))
const callbackUrl = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

/** Email + password and Google sign-in, backed by Supabase Auth. */
export function AuthForm({ initialMode = "login" }: { initialMode?: Mode }) {
  const [mode, setMode] = React.useState<Mode>(initialMode)
  const [errors, setErrors] = React.useState<Errors>({})
  const [pending, setPending] = React.useState<"email" | "google" | null>(null)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [updates, setUpdates] = React.useState(false)
  const [sent, setSent] = React.useState<Sent | null>(null)
  const t = copy[mode]

  // errors handed back by /auth/callback, e.g. an expired email link
  const callbackError = useSearchParam("error")
  // the checkout dialog hands over the email someone typed there
  const presetEmail = useSearchParam("email")
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from the URL
    if (presetEmail && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(presetEmail)) setEmail((e) => e || presetEmail.slice(0, 254))
  }, [presetEmail])
  React.useEffect(() => {
    if (!callbackError) return
    // drop ?error= so a refresh doesn't show it again
    const params = new URLSearchParams(window.location.search)
    params.delete("error")
    const qs = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
  }, [callbackError])
  const formError = errors.form ?? (callbackError ? (CALLBACK_ERRORS[callbackError] ?? CALLBACK_ERRORS.link) : undefined)

  function switchMode(next: Mode) {
    setMode(next)
    setErrors({})
    // keep the address bar in step, so refresh and back land on the same form
    window.history.replaceState(null, "", `/${next}${window.location.search}`)
  }

  function finish() {
    // keep the button spinning while the app loads; the proxy now sees the session.
    // A full load, so nothing cached from a previous account in this tab survives.
    window.location.assign(nextParam())
  }

  async function google() {
    setPending("google")
    setErrors({})
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(nextParam()) } })
    if (error) {
      setPending(null)
      setErrors({ form: authMessage(error) })
    }
    // on success the browser is already on its way to Google
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const parsed = schema.safeParse({
      name: mode === "signup" ? String(data.get("name") ?? "") : undefined,
      email: email.trim(),
      password,
    })
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message
      setErrors(next)
      document.getElementById(Object.keys(next)[0]!)?.focus()
      return
    }
    setErrors({})
    setPending("email")
    const supabase = createClient()
    const values = parsed.data

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
      if (error) {
        setPending(null)
        if (error.code === "email_not_confirmed") return setSent({ email: values.email, reason: "unconfirmed" })
        return setErrors(error.code === "invalid_credentials" ? { form: authMessage(error), password: " " } : { form: authMessage(error) })
      }
      return finish()
    }

    const { data: result, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo: callbackUrl(nextParam()), data: { full_name: values.name, marketing_opt_in: updates } },
    })
    if (error) {
      setPending(null)
      return setErrors(error.code === "weak_password" ? { password: authMessage(error) } : { form: authMessage(error) })
    }
    if (result.session) return finish() // email confirmation is off for this project
    setPending(null)
    // Supabase hides whether an address is taken; an existing account comes back with no identities
    if (result.user && result.user.identities?.length === 0) {
      return setErrors({ form: "An account with this email already exists. Log in instead.", email: " " })
    }
    setSent({ email: values.email, reason: "signup" })
  }

  async function resend() {
    if (!sent) return null
    const { error } = await createClient().auth.resend({ type: "signup", email: sent.email, options: { emailRedirectTo: callbackUrl(nextParam()) } })
    return error ? authMessage(error) : null
  }

  const clear = (key: keyof Errors) => (errors[key] || errors.form) && setErrors((e) => ({ ...e, [key]: undefined, form: undefined }))

  if (sent) {
    return (
      <CheckEmail
        email={sent.email}
        title={sent.reason === "signup" ? "Check your inbox" : "Confirm your email first"}
        body={
          sent.reason === "signup" ? (
            <>We sent a confirmation link. Open it on this device and you&apos;ll be signed straight in.</>
          ) : (
            <>This account hasn&apos;t been confirmed yet. Open the link we emailed you, or send a fresh one.</>
          )
        }
        onResend={resend}
        onBack={() => {
          setSent(null)
          setPassword("")
          if (sent.reason === "unconfirmed") switchMode("login")
        }}
        backText={sent.reason === "signup" ? "Use a different email" : "Back to log in"}
      />
    )
  }

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="mx-auto flex w-full max-w-85 flex-col">
      {/* mode switch */}
      <motion.div variants={rise} className="mx-auto">
        <div role="tablist" aria-label="Account" className="flex rounded-lg border bg-muted/50 p-0.5">
          {(
            [
              { id: "login", label: "Log in", icon: LogInIcon },
              { id: "signup", label: "Sign up", icon: UserPlusIcon },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => switchMode(id)}
              disabled={pending !== null}
              className={cn(
                "relative isolate inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors",
                mode === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === id && <motion.span layoutId="auth-mode" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* heading */}
      <motion.div variants={rise} className="mt-7 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.25, ease }}
          >
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">{t.title}</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">{t.subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* google */}
      <motion.div variants={rise} className="mt-7">
        <Button type="button" variant="outline" onClick={google} disabled={pending !== null} className="h-9 w-full gap-2 bg-background text-[13px] shadow-xs active:scale-[0.98]">
          {pending === "google" ? <LoaderCircleIcon className="animate-spin" /> : <FcGoogle className="size-4" />}
          {pending === "google" ? "Opening Google…" : "Continue with Google"}
        </Button>
      </motion.div>

      <motion.div variants={rise} className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        OR
        <span className="h-px flex-1 bg-border" />
      </motion.div>

      {/* email form */}
      <motion.form variants={rise} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <fieldset disabled={pending !== null} className="contents">
          <AnimatePresence initial={false}>
            {mode === "signup" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease }}
                className="-m-1 overflow-hidden p-1"
              >
                <Field id="name" label="Full name" error={errors.name}>
                  <Input id="name" name="name" autoComplete="name" placeholder="Rahul Mir" aria-invalid={!!errors.name || undefined} onChange={() => clear("name")} className={control} />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>

          <Field id="email" label="Email address" error={errors.email?.trim()}>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete={mode === "login" ? "username" : "email"}
              placeholder="you@business.in"
              value={email}
              aria-invalid={!!errors.email || undefined}
              onChange={(e) => {
                setEmail(e.target.value)
                clear("email")
              }}
              className={control}
            />
          </Field>

          <Field
            id="password"
            label="Password"
            error={errors.password?.trim()}
            aside={
              mode === "login" ? (
                <Link href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                  Forgot password?
                </Link>
              ) : null
            }
          >
            <PasswordInput
              id="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
              value={password}
              error={errors.password}
              onChange={(e) => {
                setPassword(e.target.value)
                clear("password")
              }}
            />
            {mode === "signup" && <PasswordMeter value={password} />}
          </Field>

          <SubmitButton pending={pending === "email"} pendingText={t.pending}>
            {t.submit}
          </SubmitButton>

          <FormAlert>{formError}</FormAlert>

          {mode === "signup" && (
            <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Checkbox checked={updates} onCheckedChange={setUpdates} className="mt-px data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand" />
              Email me new templates and product updates. No spam.
            </label>
          )}
        </fieldset>
      </motion.form>

      <motion.div variants={rise} className="mt-8 space-y-2 text-center text-xs text-muted-foreground">
        <p>
          {t.switchText}{" "}
          <button type="button" onClick={() => switchMode(mode === "login" ? "signup" : "login")} className="font-semibold text-foreground underline-offset-4 hover:underline">
            {t.switchCta}
          </button>
        </p>
        <p>
          Just need one invoice?{" "}
          <Link href="/create" className="font-semibold text-brand underline-offset-4 hover:underline dark:text-[#6da2ff]">
            Make it without an account →
          </Link>
        </p>
        {mode === "signup" && (
          <p className="text-[11px]">
            By continuing you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}
