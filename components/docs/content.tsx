import { CircleAlertIcon, InfoIcon, LightbulbIcon } from "lucide-react"
import { cn } from "cn"

/** One documentation section. The id is the anchor the side nav links to. */
export function DocSection({ id, title, children, lead }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b pb-10 mb-10 last:mb-0 last:border-b-0">
      <h2 className="group text-xl font-semibold tracking-[-0.02em]">
        <a href={`#${id}`} className="hover:underline-offset-4 group-hover:underline">
          {title}
        </a>
      </h2>
      {lead && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{lead}</p>}
      <div className="mt-4 grid gap-3 text-[14px] leading-relaxed text-foreground/85 [&_a:not([class])]:font-medium [&_a:not([class])]:text-brand [&_a:not([class])]:underline-offset-2 hover:[&_a:not([class])]:underline dark:[&_a:not([class])]:text-[#6da2ff]">{children}</div>
    </section>
  )
}

export function H3({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3 id={id} className="mt-3 scroll-mt-24 text-[15px] font-semibold text-foreground">
      {children}
    </h3>
  )
}

const tones = {
  info: { icon: InfoIcon, cls: "border-brand/25 bg-brand/5 [&_svg]:text-brand dark:[&_svg]:text-[#6da2ff]" },
  tip: { icon: LightbulbIcon, cls: "border-emerald-500/25 bg-emerald-500/5 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400" },
  warn: { icon: CircleAlertIcon, cls: "border-amber-500/30 bg-amber-500/5 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400" },
} as const

export function Callout({ tone = "info", title, children }: { tone?: keyof typeof tones; title?: string; children: React.ReactNode }) {
  const { icon: Icon, cls } = tones[tone]
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-[13px]", cls)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="grid gap-1">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        <div className="text-foreground/80">{children}</div>
      </div>
    </div>
  )
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="grid gap-3 [counter-reset:step]">{children}</ol>
}

export function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="relative grid gap-1 pl-10 [counter-increment:step] before:absolute before:top-0 before:left-0 before:grid before:size-6.5 before:place-items-center before:rounded-full before:border before:bg-background before:text-xs before:font-semibold before:content-[counter(step)]">
      <p className="pt-0.5 font-semibold text-foreground">{title}</p>
      <div className="text-foreground/80">{children}</div>
    </li>
  )
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="grid list-disc gap-1.5 pl-5 marker:text-muted-foreground">{children}</ul>
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded border bg-muted/60 px-1 py-px font-mono text-[12.5px] text-foreground">{children}</code>
}

const methodTone: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  POST: "bg-brand/10 text-brand dark:text-[#6da2ff]",
  PUT: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DELETE: "bg-red-500/10 text-red-700 dark:text-red-400",
}

/** "POST /api/invoices/{id}/pdf" header for an endpoint, with who can call it. */
export function Endpoint({ method, path, auth, children, id }: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string; auth: "Session" | "Public" | "Session or guest"; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 overflow-hidden rounded-lg border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold", methodTone[method])}>{method}</span>
        <code className="font-mono text-[13px] text-foreground">{path}</code>
        <span className="ml-auto rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{auth}</span>
      </div>
      <div className="grid gap-2 px-4 py-3 text-[13px] text-foreground/85">{children}</div>
    </div>
  )
}

/** Field reference: name, type, description. */
export function Fields({ rows }: { rows: [name: string, type: string, description: string][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(([name, type, description]) => (
            <tr key={name} className="align-top">
              <td className="px-3 py-2 font-mono text-[12.5px] whitespace-nowrap text-foreground">{name}</td>
              <td className="px-3 py-2 font-mono text-[12px] whitespace-nowrap text-muted-foreground">{type}</td>
              <td className="px-3 py-2 text-foreground/80">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Question and answer that opens in place. */
export function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border bg-background px-4 py-3 open:pb-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-medium text-foreground">
        {q}
        <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full border text-xs text-muted-foreground transition-transform duration-200 group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-2 text-[13.5px] leading-relaxed text-foreground/80">{children}</div>
    </details>
  )
}
