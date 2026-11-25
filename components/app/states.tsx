import Link from "next/link"
import { ArrowUpRightIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"

import { GuestActions } from "./guest-actions"

/** "Nothing here yet" panel with one clear next step. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  body: React.ReactNode
  action?: { label: string; href: string }
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative isolate overflow-hidden rounded-xl border bg-background px-6 py-14 text-center", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-brand/6 to-transparent" />
      <span className="mx-auto grid size-11 place-items-center rounded-xl border bg-muted/60 text-brand dark:text-[#6da2ff]">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      {action && (
        <Link href={action.href} className={cn(buttonVariants(), "mt-5 h-8 gap-1.5 px-3 text-[13px]")}>
          {action.label} <ArrowUpRightIcon className="size-3.5" />
        </Link>
      )}
      {children}
    </div>
  )
}

/** Shown to guests on pages that list saved work. */
export function GuestState({ icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <EmptyState icon={icon} title={title} body={body}>
      <GuestActions />
    </EmptyState>
  )
}

/** "That doesn't exist" for ids in the URL. */
export function MissingState({ title, body, back }: { title: string; body: string; back: { label: string; href: string } }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Not found</p>
      <h1 className="mt-2 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">{body}</p>
      <Link href={back.href} className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-8 text-[13px]")}>
        {back.label}
      </Link>
    </div>
  )
}
