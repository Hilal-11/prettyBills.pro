"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { emailReceiptAction, receiptShareAction } from "@/app/(app)/payments/actions"
import { useToast } from "@/components/invoice-editor/toast"
import { upgradeHref } from "@/lib/pricing"

/** Share, copy and email for one receipt, with the toasts each one needs. */
export function useReceiptActions() {
  const toast = useToast()
  const router = useRouter()
  const [busy, setBusy] = React.useState<string | null>(null)

  const whatsapp = React.useCallback(
    async (receiptId: string) => {
      // open the tab first so the browser doesn't treat it as a popup
      const tab = window.open("", "_blank")
      setBusy("wa")
      const r = await receiptShareAction(receiptId).catch(() => ({ ok: false as const, error: "You seem to be offline. Try again." }))
      setBusy(null)
      if (r.ok && tab) tab.location.href = r.whatsapp
      else {
        tab?.close()
        if (!r.ok) toast({ title: r.error, tone: "error" })
      }
    },
    [toast]
  )

  const copy = React.useCallback(
    async (receiptId: string) => {
      setBusy("copy")
      const r = await receiptShareAction(receiptId).catch(() => ({ ok: false as const, error: "You seem to be offline. Try again." }))
      setBusy(null)
      if (!r.ok) return toast({ title: r.error, tone: "error" })
      await navigator.clipboard.writeText(r.url).catch(() => {})
      toast({ title: "Receipt link copied", description: r.url, tone: "success", duration: 3000 })
    },
    [toast]
  )

  const retry = React.useRef<(id: string) => void>(() => {})
  const email = React.useCallback(
    async (receiptId: string) => {
      setBusy("email")
      const r = await emailReceiptAction(receiptId).catch(() => ({ ok: false as const, error: "You seem to be offline. Try again." }))
      setBusy(null)
      if (!r.ok) return toast({ title: r.error, tone: "error" })
      const e = r.email
      if (e.status === "sent") return toast({ title: `Receipt emailed to ${e.to}`, description: e.outbox ? "Email isn't set up, so it was saved to the dev outbox." : undefined, tone: "success", duration: 3500 })
      if (e.status === "upgrade" || e.status === "limit") return toast({ title: e.message, tone: "error", duration: 6000, action: e.status === "upgrade" ? { label: "See plans", onClick: () => router.push(upgradeHref("email")) } : undefined })
      toast({ title: "The receipt email didn't go out", description: e.message, tone: "error", duration: 6000, action: { label: "Retry", onClick: () => retry.current(receiptId) } })
    },
    [toast, router]
  )

  React.useEffect(() => {
    retry.current = (id) => void email(id)
  }, [email])

  return { busy, whatsapp, copy, email }
}
