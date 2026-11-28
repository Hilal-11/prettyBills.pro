import type { LucideIcon } from "lucide-react"

/**
 * Nothing to show in a full-width table area: icon, title, one line, an
 * optional action. A server component (it takes an icon component), so it
 * lives apart from the client-side table pieces in data-table.tsx.
 */
export function TableEmpty({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center px-4 py-16 text-center">
      <div className="grid max-w-sm justify-items-center gap-2">
        <span className="grid size-10 place-items-center rounded-xl border bg-muted/40 text-muted-foreground">
          <Icon className="size-4.5" />
        </span>
        <h2 className="mt-1 text-[15px] font-semibold">{title}</h2>
        <p className="text-[13px] text-muted-foreground">{body}</p>
        {children}
      </div>
    </div>
  )
}
