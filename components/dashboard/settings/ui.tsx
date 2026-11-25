"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, LogInIcon, UserPlusIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { authHref } from "@/lib/client/handoff"

export function TabHeader({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 pb-5">
      <div className="grid gap-1">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

/** A titled card of rows, the building block of every settings tab. */
export function Group({ title, description, children, className, footer }: { title?: string; description?: React.ReactNode; children: React.ReactNode; className?: string; footer?: React.ReactNode }) {
  return (
    <section className={cn("mb-6 last:mb-0", className)}>
      {title && <h3 className="text-[13px] font-semibold">{title}</h3>}
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className={cn("overflow-hidden rounded-lg border bg-background", title && "mt-2.5")}>
        <div className="divide-y">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-4 py-2.5">{footer}</div>}
      </div>
    </section>
  )
}

/** Label and hint on the left, the control on the right. Stacks on narrow screens. */
export function Row({ label, hint, children, htmlFor, className }: { label: React.ReactNode; hint?: React.ReactNode; children?: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}>
      <div className="grid min-w-0 gap-0.5">
        <label htmlFor={htmlFor} className="text-[13px] font-medium">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}

/** "Saved" tick that fades in next to a save button. */
export function SavedTick({ show }: { show: boolean }) {
  return (
    <span aria-live="polite" className={cn("inline-flex items-center gap-1 text-xs text-brand transition-opacity duration-300 dark:text-[#6da2ff]", show ? "opacity-100" : "opacity-0")}>
      {show && (
        <>
          <CheckIcon className="size-3.5" /> Saved
        </>
      )}
    </span>
  )
}

/** Shows "Saved" for a moment after `flash()` is called. */
export function useSavedFlash(ms = 2200) {
  const [shown, setShown] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  const flash = React.useCallback(() => {
    setShown(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setShown(false), ms)
  }, [ms])
  return [shown, flash] as const
}

/** For guests, in place of anything that needs an account. Whatever they've typed comes along. */
export function GuestCard({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  const router = useRouter()
  const [going, setGoing] = React.useState<"signup" | "login" | null>(null)
  const go = (mode: "signup" | "login") => {
    setGoing(mode)
    router.push(authHref(mode))
  }
  return (
    <div className="relative overflow-hidden rounded-xl border bg-background px-6 py-8 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-brand/8 to-transparent" />
      <span className="relative mx-auto grid size-11 place-items-center rounded-xl bg-linear-to-b from-brand to-brand-deep text-white shadow-[0_3px_0_var(--brand-shadow)]">
        <Icon className="size-5" />
      </span>
      <p className="relative mt-4 text-[15px] font-semibold">{title}</p>
      <p className="relative mx-auto mt-1.5 max-w-sm text-[13px] text-muted-foreground">{body}</p>
      <div className="relative mt-5 flex flex-wrap justify-center gap-2">
        <Button className="h-9 gap-1.5 text-[13px]" disabled={going !== null} onClick={() => go("signup")}>
          <UserPlusIcon /> {going === "signup" ? "Opening…" : "Create free account"}
        </Button>
        <Button variant="outline" className="h-9 gap-1.5 text-[13px]" disabled={going !== null} onClick={() => go("login")}>
          <LogInIcon /> {going === "login" ? "Opening…" : "Log in"}
        </Button>
      </div>
      <p className="relative mt-3 text-[11px] text-muted-foreground">The invoice you&apos;re working on comes with you.</p>
    </div>
  )
}
