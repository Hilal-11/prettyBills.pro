"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { ShieldCheckIcon } from "lucide-react"

import { authMessage } from "@/lib/auth/messages"
import { rise, stagger } from "@/lib/motion"
import { createClient } from "@/lib/supabase/client"

import { Field, FormAlert, PasswordInput, PasswordMeter, SubmitButton } from "./auth-ui"

/** Sets a new password. Reached from the reset email, which has already signed the user in. */
export function ResetForm() {
  const router = useRouter()
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [errors, setErrors] = React.useState<{ password?: string; confirm?: string; form?: string }>({})
  const [state, setState] = React.useState<"idle" | "pending" | "done">("idle")

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 8) return setErrors({ password: "Use at least 8 characters" })
    if (password.length > 72) return setErrors({ password: "Use at most 72 characters" })
    if (confirm !== password) return setErrors({ confirm: "The passwords don't match" })
    setState("pending")
    const { error } = await createClient().auth.updateUser({ password })
    if (error) {
      setState("idle")
      return setErrors(error.code === "weak_password" || error.code === "same_password" ? { password: authMessage(error) } : { form: authMessage(error) })
    }
    setState("done")
    setTimeout(() => {
      router.replace("/dashboard")
      router.refresh()
    }, 1100)
  }

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="mx-auto flex w-full max-w-85 flex-col">
      <motion.span variants={rise} className="mx-auto grid size-11 place-items-center rounded-xl bg-linear-to-b from-brand to-brand-deep text-white shadow-[0_3px_0_var(--brand-shadow)]">
        <ShieldCheckIcon className="size-5" />
      </motion.span>
      <motion.div variants={rise} className="mt-5 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Choose a new password</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">You&apos;ll use it the next time you log in.</p>
      </motion.div>

      <motion.form variants={rise} onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-4">
        <fieldset disabled={state !== "idle"} className="contents">
          <Field id="password" label="New password" error={errors.password}>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              autoFocus
              placeholder="At least 8 characters"
              value={password}
              error={errors.password}
              onChange={(e) => {
                setPassword(e.target.value)
                setErrors({})
              }}
            />
            <PasswordMeter value={password} />
          </Field>
          <Field id="confirm" label="Confirm password" error={errors.confirm}>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              placeholder="Type it again"
              value={confirm}
              error={errors.confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setErrors({})
              }}
            />
          </Field>
          <SubmitButton pending={state === "pending"} pendingText="Saving…">
            Save new password
          </SubmitButton>
        </fieldset>
        <FormAlert>{errors.form}</FormAlert>
        <FormAlert tone="success">{state === "done" ? "Password updated. Taking you to your dashboard…" : undefined}</FormAlert>
      </motion.form>
    </motion.div>
  )
}
