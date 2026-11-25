import { cn } from "cn"

import { trackAttrs } from "@/lib/analytics"

export const SUPPORT_URL = "https://buymeacoffee.com/hilal_11"

/** Takeaway cup in the Buy Me a Coffee style: white cup, coffee filling the bottom. */
export function CoffeeCup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {/* cup */}
      <path d="M6.2 8.2 7.6 20a1.2 1.2 0 0 0 1.2 1h6.4a1.2 1.2 0 0 0 1.2-1l1.4-11.8Z" fill="#fff" />
      {/* coffee */}
      <path d="M6.9 13.2h10.2L16.4 20a1.2 1.2 0 0 1-1.2 1H8.8a1.2 1.2 0 0 1-1.2-1Z" fill="#FFDD00" strokeWidth={0} />
      <path d="M6.2 8.2 7.6 20a1.2 1.2 0 0 0 1.2 1h6.4a1.2 1.2 0 0 0 1.2-1l1.4-11.8" />
      {/* lid */}
      <path d="M5.2 8.2h13.6" />
      <path d="M6.2 8.2 7 5.4a1 1 0 0 1 1-.7h8a1 1 0 0 1 1 .7l.8 2.8" fill="#fff" />
    </svg>
  )
}

const base =
  "group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#e8c800] bg-[#FFDD00] font-semibold text-[#0D0C22] shadow-[0_2px_0_#c9a800] transition-[background-color,transform,box-shadow] outline-none select-none hover:bg-[#ffe23d] focus-visible:ring-3 focus-visible:ring-[#FFDD00]/50 active:translate-y-px active:scale-[0.97] active:shadow-[0_1px_0_#c9a800]"

const sizes = {
  /** h-8 with label, like the other page buttons */
  default: { button: "h-8 px-3 text-[13px]", label: "" },
  /** h-7, like the navbar's buttons */
  nav: { button: "h-7 px-2.5 text-[13px]", label: "" },
  /** just the cup until the screen is very wide (crowded toolbars) */
  compact: { button: "h-8 w-8 px-0 text-[13px] min-[1700px]:w-auto min-[1700px]:px-3", label: "hidden min-[1700px]:inline" },
} as const

/** Yellow "Buy me a coffee" link to support PrettyBills. Opens in a new tab. */
export function SupportButton({ section, size = "default", className }: { section: string; size?: keyof typeof sizes; className?: string }) {
  const s = sizes[size]
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Buy me a coffee (opens in a new tab)"
      title="Support PrettyBills: buy me a coffee"
      className={cn(base, s.button, className)}
      {...trackAttrs("support_click", section)}
    >
      <CoffeeCup className="transition-transform duration-300 ease-out group-hover:-rotate-12" />
      <span className={cn("whitespace-nowrap", s.label)}>Buy me a coffee</span>
    </a>
  )
}
