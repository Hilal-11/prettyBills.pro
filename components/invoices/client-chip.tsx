import { cn } from "cn"

/** A small square in two neighbouring hues, the same for a name every time, so clients are easy to spot down a column. */
export function ClientChip({ name, className }: { name: string; className?: string }) {
  let h = 0
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const hue = h % 360
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3.5 shrink-0 rounded-[4px] ring-1 ring-foreground/10 ring-inset", className)}
      style={{ background: name.trim() ? `linear-gradient(135deg, oklch(0.78 0.13 ${hue}), oklch(0.62 0.17 ${(hue + 50) % 360}))` : "var(--muted)" }}
    />
  )
}
