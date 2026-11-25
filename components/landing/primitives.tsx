import type { ComponentProps } from "react"
import Link from "next/link"
import { cn } from "cn"
import type { VariantProps } from "class-variance-authority"

import { buttonVariants } from "@/components/ui/button"
import { trackAttrs, type AnalyticsEvent } from "@/lib/analytics"
import Image from "next/image"

/**
 * A link styled as a button. Base UI's Button enforces `role="button"`, so its
 * docs say links must not be rendered through it: style the <a> instead.
 */
export function CtaLink({
  href,
  event,
  section,
  variant,
  size,
  className,
  children,
  ...props
}: Omit<ComponentProps<"a">, "href"> &
  VariantProps<typeof buttonVariants> & {
    href: string
    event: AnalyticsEvent
    section: string
  }) {
  const attrs = trackAttrs(event, section)
  const classes = cn(buttonVariants({ variant, size }), "active:scale-[0.97]", className)
  if (href.startsWith("#") || href.startsWith("http")) {
    return (
      <a href={href} className={classes} {...attrs} {...props}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={classes} {...attrs} {...props}>
      {children}
    </Link>
  )
}

/** Arrow that nudges right when its parent button is hovered. */
export function ArrowNudge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      data-icon="inline-end"
      className={cn("size-3.5 transition-transform duration-200 ease-out group-hover/button:translate-x-0.5", className)}
    >
      <path d="M3 8h9.5M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-sm font-semibold tracking-tight", className)}>
      <Image src="/light-icon.png" alt="alt" width={36} height={36} className="border-1 border-beutral-700 dark:border-beutral-900 rounded-[6.9px]"/>
    </div>
  )
}
