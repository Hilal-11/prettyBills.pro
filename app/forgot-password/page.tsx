import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotForm } from "@/components/auth/forgot-form"

export const metadata: Metadata = {
  title: "Reset your password · PrettyBills",
  robots: { index: false },
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell label="Reset your password" back={{ href: "/login", text: "Back to log in" }}>
      <ForgotForm />
    </AuthShell>
  )
}
