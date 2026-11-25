"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { KeyRoundIcon } from "lucide-react"
import { z } from "zod"

import { Input } from "@/components/ui/input"
import { authMessage } from "@/lib/auth/messages"
import { rise, stagger } from "@/lib/motion"
import { createClient } from "@/lib/supabase/client"

import { CheckEmail, Field, FormAlert, SubmitButton, control, useSearchParam } from "./auth-ui"

const emailSchema = z.email("Enter a valid email")
const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`

/** Sends a password-reset link. The link signs the user in and opens /reset-password. */
export function ForgotForm() {
  // prefilled from the login form's "Forgot password?" link
  const prefill = useSearchParam("email")
  const [typed, setEmail] = React.useState<string | null>(null)
  const email = typed ?? prefill ?? ""
  const [error, setError] = React.useState<{ field?: string; form?: string }>({})
  const [pending, setPending] = React.useState(false)
  const [sent, setSent] = React.useState<string | null>(null)

  async function send(address: string) {
    const { error } = await createClient().auth.resetPasswordForEmail(address, { redirectTo: redirectTo() })
    return error ? authMessage(error) : null
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = emailSchema.safeParse(email.trim())
    if (!parsed.success) return setError({ field: parsed.error.issues[0]!.message })
    setPending(true)
    const message = await send(parsed.data)
    setPending(false)
    if (message) return setError({ form: message })
    setSent(parsed.data)
  }

  if (sent) {
    return (
      <CheckEmail
        email={sent}
        title="Check your inbox"
        body={<>If there&apos;s an account for this email, a reset link is on its way. It works once and expires in an hour.</>}
        onResend={() => send(sent)}
        onBack={() => setSent(null)}
      />
    )
  }

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="mx-auto flex w-full max-w-85 flex-col">
      <motion.span variants={rise} className="mx-auto grid size-11 place-items-center rounded-xl border bg-muted/50 text-foreground">
        <KeyRoundIcon className="size-5" />
      </motion.span>
      <motion.div variants={rise} className="mt-5 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Forgot your password?</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      </motion.div>

      <motion.form variants={rise} onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-4">
        <Field id="email" label="Email address" error={error.field}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder="you@business.in"
            value={email}
            disabled={pending}
            aria-invalid={!!error.field || undefined}
            onChange={(e) => {
              setEmail(e.target.value)
              setError({})
            }}
            className={control}
          />
        </Field>
        <SubmitButton pending={pending} pendingText="Sending link…">
          Send reset link
        </SubmitButton>
        <FormAlert>{error.form}</FormAlert>
      </motion.form>

      <motion.p variants={rise} className="mt-8 text-center text-xs text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </motion.p>
    </motion.div>
  )
}
