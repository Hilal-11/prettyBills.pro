"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CircleCheckIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { ease } from "@/lib/motion"

type Toast = {
  id: number
  title: string
  description?: string
  tone?: "default" | "success" | "error"
  action?: { label: string; onClick: () => void }
  duration?: number
}

const ToastContext = React.createContext<(t: Omit<Toast, "id">) => void>(() => {})

export const useToast = () => React.useContext(ToastContext)

let seq = 0

/** Lightweight toasts, stacked top-centre so they never cover primary actions. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const dismiss = React.useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])
  const push = React.useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq
      setToasts((all) => [...all.slice(-2), { ...t, id }])
      setTimeout(() => dismiss(id), t.duration ?? 4000)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.25, ease }}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-popover px-3.5 py-3 text-popover-foreground shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)]"
            >
              {t.tone === "success" && <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" />}
              {t.tone === "error" && <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
              </div>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick()
                    dismiss(t.id)
                  }}
                  className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand/10 dark:text-[#6da2ff]")}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <XIcon className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
