import type { Metadata } from "next"

import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"

export const metadata: Metadata = {
  title: "Sign up · PrettyBills",
  description: "Create a free PrettyBills account to save, send and track your GST invoices.",
}

export default function SignupPage() {
  return (
    <AuthShell label="Log in or sign up">
      <AuthForm initialMode="signup" />
    </AuthShell>
  )
}
