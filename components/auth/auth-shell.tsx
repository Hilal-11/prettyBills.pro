import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { AuthShowcase } from "@/components/auth/auth-showcase"
import { DEFAULT_TEMPLATE, InvoiceDocument } from "@/components/landing/invoice-document"

/**
 * Card used by every auth page: form on the left, product visual on the right
 * (hidden below lg). `back` is the link above the card.
 */
export function AuthShell({ children, label, back = { href: "/", text: "Back to home" } }: { children: ReactNode; label: string; back?: { href: string; text: string } }) {
  return (
    <div className="relative isolate flex min-h-svh flex-col">
      <main className="flex flex-1 items-center justify-center px-3 py-6 sm:px-6">
        <div className="w-full max-w-6xl">
          <Link
            href={back.href}
            className="group mb-3 inline-flex items-center gap-1.5 rounded-full border bg-background/70 py-1 pr-3 pl-1 text-xs text-muted-foreground shadow-xs backdrop-blur transition-[color,background-color,scale] hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.97]"
          >
            <span className="grid size-5 place-items-center rounded-full bg-muted text-foreground">
              <ArrowLeftIcon className="size-3 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
            </span>
            {back.text}
          </Link>

          <div className="grid w-full gap-3 rounded-2xl border bg-background p-3 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.25)] lg:grid-cols-[1fr_1.05fr] dark:shadow-[0_30px_80px_-40px_rgb(0_0_0/0.9)]">
            <section aria-label={label} className="flex min-h-[560px] items-center justify-center px-4 py-10 sm:px-8 lg:py-12">
              {children}
            </section>
            <aside aria-label="About PrettyBills" className="hidden lg:block">
              <AuthShowcase invoice={<InvoiceDocument template={DEFAULT_TEMPLATE} fill decorative />} />
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
