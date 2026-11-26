import { CrownIcon } from "lucide-react"
import { cn } from "cn"

/**
 * Marks something as part of Pro. `ProMark` is the round crown that sits
 * inside a button; `ProBadge` is the "Pro" pill for menus, cards and lists.
 * Gold reads as premium on both the blue primary button and plain surfaces.
 */
export function ProMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center rounded-full bg-amber-400 text-amber-950 shadow-[inset_0_-1px_0_rgb(0_0_0/0.18)]", className)}>
      <CrownIcon className="size-2.5" strokeWidth={2.5} />
    </span>
  )
}

export function ProBadge({ className, children = "Pro" }: { className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/15 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:text-amber-300", className)}>
      <CrownIcon className="size-2.5" strokeWidth={2.5} aria-hidden />
      {children}
    </span>
  )
}
