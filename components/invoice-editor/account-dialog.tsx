"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { CheckIcon, CloudUploadIcon, LinkIcon, LogInIcon, SendIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { authHref } from "@/lib/client/handoff"
import { ease } from "@/lib/motion"

import type { AccountReason, EditorApi } from "./use-editor"

const copy: Record<AccountReason, { icon: typeof SendIcon; title: string; body: string }> = {
  save: {
    icon: CloudUploadIcon,
    title: "Keep this invoice",
    body: "You're using PrettyBills as a guest, so nothing is saved. Create a free account and this invoice saves itself as you type.",
  },
  send: {
    icon: SendIcon,
    title: "Log in to send by email",
    body: "Emails go out from your account, so clients can reply to you. Emailing is part of Pro; sharing a link is free.",
  },
  share: {
    icon: LinkIcon,
    title: "Log in to share a link",
    body: "A link needs the invoice saved online. Create a free account and share it on WhatsApp or anywhere else.",
  },
  default: {
    icon: CloudUploadIcon,
    title: "Save your work, free",
    body: "You're using PrettyBills as a guest, so nothing is saved. A free account keeps everything for next time.",
  },
}

const perks = ["Autosaves as you type, on every device", "Share a link and see when it's viewed", "Reuse your clients, items and business details"]

/** Shown to guests at the moments an account matters. Whatever they typed comes along. */
export function AccountDialog({ ed }: { ed: EditorApi }) {
  const router = useRouter()
  const [going, setGoing] = React.useState<"signup" | "login" | null>(null)
  const reason = ed.accountPrompt ?? "default"
  const { icon: Icon, title, body } = copy[reason]

  function go(mode: "signup" | "login") {
    setGoing(mode)
    router.push(authHref(mode))
  }

  return (
    <Dialog open={ed.accountPrompt !== null} onOpenChange={(open) => !open && ed.closeAccountPrompt()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[400px]">
        <div className="relative px-6 pt-7 pb-5 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-brand/10 to-transparent" />
          <motion.span
            key={reason}
            initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.45, duration: 0.55 }}
            className="relative mx-auto grid size-11 place-items-center rounded-xl bg-linear-to-b from-brand to-brand-deep text-white shadow-[0_3px_0_var(--brand-shadow)]"
          >
            <Icon className="size-5" />
          </motion.span>
          <DialogTitle className="relative mt-4 text-lg font-semibold tracking-[-0.01em]">{title}</DialogTitle>
          <DialogDescription className="relative mt-1.5 text-[13px] text-muted-foreground">{body}</DialogDescription>
        </div>

        <ul className="mx-6 space-y-2 rounded-lg border bg-muted/30 p-3">
          {perks.map((p, i) => (
            <motion.li key={p} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease, delay: 0.08 + i * 0.05 }} className="flex items-start gap-2 text-[13px]">
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand/15 text-brand dark:text-[#6da2ff]">
                <CheckIcon className="size-3" />
              </span>
              {p}
            </motion.li>
          ))}
        </ul>
        <p className="mx-6 mt-3 text-center text-xs text-muted-foreground">Nothing you&apos;ve typed is lost: this invoice comes with you.</p>

        <div className="grid gap-2 px-6 pt-5 pb-6">
          <Button className="h-9 text-[13px] active:scale-[0.98]" disabled={going !== null} onClick={() => go("signup")}>
            {going === "signup" ? "Opening…" : "Create free account"}
          </Button>
          <Button variant="outline" className="h-9 text-[13px] active:scale-[0.98]" disabled={going !== null} onClick={() => go("login")}>
            <LogInIcon /> {going === "login" ? "Opening…" : "I have an account"}
          </Button>
          <Button variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={ed.closeAccountPrompt}>
            Keep editing as a guest
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Stand-in for "save as my default" checkboxes when signed out. */
export function GuestSaveHint({ ed, children }: { ed: EditorApi; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CloudUploadIcon className="size-3.5 shrink-0" />
      <span>
        <button type="button" onClick={() => ed.askAccount("save")} className="font-semibold text-brand underline-offset-2 hover:underline dark:text-[#6da2ff]">
          Log in
        </button>{" "}
        {children}
      </span>
    </p>
  )
}
