import type { Metadata } from "next"

import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"

export const metadata: Metadata = {
  title: "Log in · PrettyBills",
  description: "Log in or create a free PrettyBills account to save, send and track your GST invoices.",
}

export default function LoginPage() {
  return (
    <AuthShell label="Log in or sign up">
      <AuthForm initialMode="login" />
    </AuthShell>
  )
}
