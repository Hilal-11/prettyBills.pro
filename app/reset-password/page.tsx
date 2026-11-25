import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { ResetForm } from "@/components/auth/reset-form"

export const metadata: Metadata = {
  title: "Choose a new password · PrettyBills",
  robots: { index: false },
}

/** Signed-in only (the proxy sends everyone else to /login). */
export default function ResetPasswordPage() {
  return (
    <AuthShell label="Choose a new password" back={{ href: "/dashboard", text: "Back to dashboard" }}>
      <ResetForm />
    </AuthShell>
  )
}
