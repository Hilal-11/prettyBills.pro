"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckIcon, LoaderCircleIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useKeyLabels } from "@/lib/client/platform"
import { FEEDBACK_TOPICS, type FeedbackTopic } from "@/lib/feedback"
import { ease } from "@/lib/motion"
import { createClient } from "@/lib/supabase/client"

const MOODS = [
  { value: 1, emoji: "😠", label: "Frustrated" },
  { value: 2, emoji: "🙁", label: "Not great" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😍", label: "Love it" },
] as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Topic, message, an optional mood and (for guests) an optional reply email.
 * Used in the dashboard dialog and on the help center.
 */
export function FeedbackForm({ onDone, autoFocus, source, initialTopic = null }: { onDone?: () => void; autoFocus?: boolean; source: string; initialTopic?: FeedbackTopic | null }) {
  const { mod } = useKeyLabels()
  const [topic, setTopic] = React.useState<FeedbackTopic | null>(initialTopic)
  const [message, setMessage] = React.useState("")
  const [mood, setMood] = React.useState<number | null>(null)
  const [email, setEmail] = React.useState("")
  const [guest, setGuest] = React.useState<boolean | null>(null)
  const [state, setState] = React.useState<{ status: "idle" | "sending" | "sent" } | { status: "error"; message: string }>({ status: "idle" })
  const [tried, setTried] = React.useState(false)

  React.useEffect(() => {
    let live = true
    createClient()
      .auth.getSession()
      .then(({ data }) => live && setGuest(!data.session))
    return () => {
      live = false
    }
  }, [])

  const messageError = tried && message.trim().length < 3 ? "Write a few words so we know what you mean." : undefined
  const topicError = tried && !topic ? "Pick a topic." : undefined
  const emailError = tried && email && !EMAIL.test(email.trim()) ? "That email doesn't look right." : undefined

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    setTried(true)
    if (!topic || message.trim().length < 3 || (email && !EMAIL.test(email.trim()))) return
    setState({ status: "sending" })
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, message: message.trim(), mood, email: email.trim() || undefined, page: `${source} ${window.location.pathname}` }),
    }).catch(() => null)
    if (!res) return setState({ status: "error", message: "You seem to be offline. Try again in a moment." })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      return setState({ status: "error", message: body?.error ?? "Couldn't send that. Try again in a moment." })
    }
    setState({ status: "sent" })
  }

  function reset() {
    setTopic(null)
    setMessage("")
    setMood(null)
    setEmail("")
    setTried(false)
    setState({ status: "idle" })
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state.status === "sent" ? (
        <motion.div key="sent" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }} className="grid justify-items-center px-2 py-6 text-center" role="status">
          <motion.span
            initial={{ scale: 0.5, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
            className="grid size-11 place-items-center rounded-full bg-linear-to-b from-brand to-brand-deep text-white shadow-[0_3px_0_var(--brand-shadow)]"
          >
            <CheckIcon className="size-5" />
          </motion.span>
          <p className="mt-4 text-[15px] font-semibold">Thanks, we got it</p>
          <p className="mt-1 max-w-72 text-[13px] text-muted-foreground">
            Every message is read by the people building PrettyBills.{guest && email ? " We'll reply by email if we need to." : ""}
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={reset}>
              Send another
            </Button>
            {onDone && (
              <Button size="sm" className="h-8 text-xs" onClick={onDone}>
                Done
              </Button>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onSubmit={send}
          noValidate
          className="grid gap-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send()
          }}
        >
          <div className="grid gap-1">
            <Select items={FEEDBACK_TOPICS} value={topic} onValueChange={(v) => setTopic(v as FeedbackTopic | null)}>
              <SelectTrigger aria-label="Topic" aria-invalid={!!topicError || undefined} className="h-9 w-full bg-background text-[13px]">
                <SelectValue placeholder="Select a topic…" />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_TOPICS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-[13px]">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {topicError && <p className="text-[11px] text-destructive">{topicError}</p>}
          </div>

          <div className="grid gap-1">
            <Textarea
              aria-label="Your feedback"
              placeholder="Your feedback…"
              value={message}
              autoFocus={autoFocus}
              maxLength={2000}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={!!messageError || undefined}
              className="min-h-28 resize-none bg-background text-[13px] md:text-[13px]"
            />
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] text-destructive">{messageError}</p>
              {message.length > 1500 && <p className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{2000 - message.length} left</p>}
            </div>
          </div>

          {guest && (
            <div className="grid gap-1">
              <Input
                type="email"
                aria-label="Your email, if you'd like a reply"
                placeholder="Email, if you'd like a reply (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!emailError || undefined}
                className="h-9 bg-background text-[13px] md:text-[13px]"
              />
              {emailError && <p className="text-[11px] text-destructive">{emailError}</p>}
            </div>
          )}

          <AnimatePresence initial={false}>
            {state.status === "error" && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} role="alert" className="overflow-hidden text-xs text-destructive">
                {state.message}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="-mx-4 -mb-4 flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-0.5" role="radiogroup" aria-label="How do you feel about PrettyBills?">
              {MOODS.map((m) => {
                const on = mood === m.value
                return (
                  <motion.button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={m.label}
                    title={m.label}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setMood(on ? null : m.value)}
                    className={cn(
                      "grid size-8 place-items-center rounded-full text-[17px] leading-none transition-[filter,opacity,background-color,transform] duration-200",
                      on ? "scale-110 bg-brand/10 grayscale-0 ring-1 ring-brand/30" : "opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                    )}
                  >
                    <span aria-hidden>{m.emoji}</span>
                  </motion.button>
                )
              })}
            </div>
            <Button type="submit" disabled={state.status === "sending"} className="h-8 gap-1.5 px-4 text-[13px] active:scale-[0.98]" title={`Send (${mod} Enter)`}>
              {state.status === "sending" && <LoaderCircleIcon className="animate-spin" />}
              {state.status === "sending" ? "Sending…" : "Send"}
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  )
}

export function FeedbackDialog({ open, onOpenChange, topic }: { open: boolean; onOpenChange: (open: boolean) => void; topic?: FeedbackTopic }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <div className="px-4 pt-4 pb-3">
          <DialogTitle className="text-[15px] font-semibold">Send feedback</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-muted-foreground">An idea, a bug, or something that felt slow. We read every message.</DialogDescription>
        </div>
        <div className="px-4 pb-4">
          <FeedbackForm key={topic ?? "any"} source="dashboard" autoFocus initialTopic={topic ?? null} onDone={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
