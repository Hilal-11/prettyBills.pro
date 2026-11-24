"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { EyeIcon, EyeOffIcon, LoaderCircleIcon, LogInIcon, UserPlusIcon } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { z } from "zod"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ease, rise, spring, stagger } from "@/lib/motion"

type Mode = "login" | "signup"

const copy = {
  login: {
    title: "Welcome back",
    subtitle: "Log in to send, track and get paid on your invoices.",
    submit: "Log in",
    switchText: "Don't have an account?",
    switchCta: "Sign up",
  },
  signup: {
    title: "Create your account",
    subtitle: "Save your invoices, send them and get paid. Free forever.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchCta: "Log in",
  },
} as const

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").optional(),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
})

type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>

const control = "h-9 bg-background text-[13px] md:text-[13px]"

/**
 * Email + Google auth form (UI only). Validation is real; submitting shows the
 * loading state and then says sign-in isn't connected, rather than faking success.
 */
export function AuthForm() {
  const [mode, setMode] = React.useState<Mode>("login")
  const [showPassword, setShowPassword] = React.useState(false)
  const [errors, setErrors] = React.useState<Errors>({})
  const [pending, setPending] = React.useState<"email" | "google" | null>(null)
  const t = copy[mode]

  function switchMode(next: Mode) {
    setMode(next)
    setErrors({})
  }

  async function notConnected(kind: "email" | "google") {
    setPending(kind)
    await new Promise((r) => setTimeout(r, 900))
    setPending(null)
    // PLACEHOLDER: replace with the real auth call once the provider is chosen.
    setErrors({ form: "Sign-in isn't connected yet. You can still make an invoice without an account." })
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const parsed = schema.safeParse({
      name: mode === "signup" ? String(data.get("name") ?? "") : undefined,
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    })
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors
        next[key] ??= issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    void notConnected("email")
  }

  const clear = (key: keyof Errors) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined, form: undefined }))

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="mx-auto flex w-full max-w-[340px] flex-col">
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
        <Button
          type="button"
          variant="outline"
          onClick={() => notConnected("google")}
          disabled={pending !== null}
          className="h-9 w-full gap-2 bg-background text-[13px] shadow-xs active:scale-[0.98]"
        >
          {pending === "google" ? <LoaderCircleIcon className="animate-spin" /> : <FcGoogle className="size-4" />}
          Continue with Google
        </Button>
      </motion.div>

      <motion.div variants={rise} className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        OR
        <span className="h-px flex-1 bg-border" />
      </motion.div>

      {/* email form */}
      <motion.form variants={rise} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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

        <Field id="email" label="Email address" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@business.in"
            aria-invalid={!!errors.email || undefined}
            onChange={() => clear("email")}
            className={control}
          />
        </Field>

        <Field
          id="password"
          label="Password"
          error={errors.password}
          aside={
            mode === "login" ? (
              <Link href="/forgot-password" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                Forgot password?
              </Link>
            ) : null
          }
        >
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
              aria-invalid={!!errors.password || undefined}
              onChange={() => clear("password")}
              className={cn(control, "pr-9")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={showPassword ? "hide" : "show"}
                  initial={{ opacity: 0, scale: 0.6, rotate: -45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6, rotate: 45 }}
                  transition={{ duration: 0.18 }}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </Field>

        <Button type="submit" disabled={pending !== null} className="mt-1 h-9 w-full text-[13px] active:scale-[0.98]">
          {pending === "email" && <LoaderCircleIcon className="animate-spin" />}
          {pending === "email" ? (mode === "login" ? "Logging in…" : "Creating account…") : t.submit}
        </Button>

        <AnimatePresence initial={false}>
          {errors.form && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease }}
              className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
            >
              {errors.form}
            </motion.p>
          )}
        </AnimatePresence>

        <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
          <Checkbox name={mode === "login" ? "remember" : "updates"} defaultChecked={mode === "login"} className="mt-px data-checked:border-brand-deep data-checked:bg-brand dark:data-checked:bg-brand" />
          {mode === "login" ? "Keep me logged in on this device." : "Email me new templates and product updates. No spam."}
        </label>
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

function Field({ id, label, error, aside, children }: { id: string; label: string; error?: string; aside?: React.ReactNode; children: React.ReactNode }) {
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
