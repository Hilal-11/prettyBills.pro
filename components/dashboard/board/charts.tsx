"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"
import { cn } from "cn"

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { AGEING, STATUS_ORDER, type DashboardCharts } from "@/lib/billing/dashboard"
import { MODE_LABEL, PAYMENT_MODES } from "@/lib/billing/modes"
import { formatMoney } from "@/lib/invoice/totals"
import { spring } from "@/lib/motion"

import { Quiet } from "./quiet"

/* -------------------------------- palette -------------------------------- */
// Categorical slots, validated for colour-blind separation in both themes
// (dataviz validate_palette.js); slot 1 is the brand blue. Light-mode slots
// 2-5 sit under 3:1 on white, so every chart here prints its values beside
// the marks (legend rows with numbers).
const CAT = {
  light: ["#0061ff", "#f47230", "#00b894", "#f2a600", "#ee7fac", "#6a4ce2"],
  dark: ["#4d8dff", "#e76624", "#00a888", "#d28e05", "#e24d8b", "#9887ef"],
}
// Status colours: the same dots the status badges use, always shown with a label.
const STATUS = {
  draft: { label: "Draft", light: "#a1a1aa", dark: "#71717a" },
  sent: { label: "Sent", light: "#0ea5e9", dark: "#38bdf8" },
  overdue: { label: "Overdue", light: "#ef4444", dark: "#f87171" },
  paid: { label: "Paid", light: "#10b981", dark: "#34d399" },
  void: { label: "Void", light: "#d4d4d8", dark: "#52525b" },
} as const
// Ageing is magnitude (how late), so one hue, light to dark (reversed on dark surfaces).
const AGE = { light: ["#a9c8ff", "#6fa3ff", "#2f7bff", "#0a4fd6", "#0b2f80"], dark: ["#1d3a75", "#2a5bbf", "#4d8dff", "#8ab4ff", "#cadcff"] }

const cat = (i: number) => ({ light: CAT.light[i % 6], dark: CAT.dark[i % 6] })

/* ------------------------------- formatting ------------------------------ */

/** Indian compact money for axes and tight spots: ₹950, ₹12K, ₹3.4L, ₹1.2Cr. */
export function compactINR(paise: number) {
  const r = Math.abs(paise) / 100
  const sign = paise < 0 ? "−" : ""
  const fmt = (n: number, unit: string) => `${sign}₹${n >= 100 ? Math.round(n) : n.toFixed(1).replace(/\.0$/, "")}${unit}`
  if (r >= 1e7) return fmt(r / 1e7, "Cr")
  if (r >= 1e5) return fmt(r / 1e5, "L")
  if (r >= 1e3) return fmt(r / 1e3, "K")
  return `${sign}₹${Math.round(r)}`
}
const money = (p: number) => formatMoney(p, { whole: true })

type TipRow = { label: string; value: string; color?: string }

/** The one tooltip look every chart shares. */
function Tip({ title, rows }: { title?: string; rows: TipRow[] }) {
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-lg">
      {title && <span className="font-medium">{title}</span>}
      {rows.map((r) => (
        <span key={r.label} className="flex items-center gap-2">
          {r.color && <span className="size-2 shrink-0 rounded-[3px]" style={{ background: r.color }} />}
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto font-medium tabular-nums">{r.value}</span>
        </span>
      ))}
    </div>
  )
}

/** Legend row: swatch, name, value(s). Text stays in text colours; the swatch carries identity. */
function LegendRow({ color, label, value, sub, href }: { color: string; label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
      {sub !== undefined && <span className="w-10 text-right text-muted-foreground tabular-nums">{sub}</span>}
    </>
  )
  const cls = "flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px]"
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-muted/60")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Picks the light or dark step of a colour pair by the current theme (for HTML swatches; charts use CSS variables). */
function useDark() {
  return React.useSyncExternalStore(
    (cb) => {
      const o = new MutationObserver(cb)
      o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
      return () => o.disconnect()
    },
    () => document.documentElement.classList.contains("dark"),
    () => false
  )
}

export { Quiet } from "./quiet"

/* ------------------------- collected vs invoiced ------------------------- */

const cashConfig = {
  collected: { label: "Collected", theme: cat(0) },
  invoiced: { label: "Invoiced", theme: cat(1) },
} satisfies ChartConfig

export function CashflowChart({ data, tall }: { data: DashboardCharts["monthly"]; tall?: boolean }) {
  const [range, setRange] = React.useState<3 | 6 | 12>(12)
  const dark = useDark()
  const rows = data.slice(-range)
  const totals = rows.reduce((t, r) => ({ invoiced: t.invoiced + r.invoiced, collected: t.collected + r.collected }), { invoiced: 0, collected: 0 })
  const empty = rows.every((r) => !r.invoiced && !r.collected)
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-2 px-4 pt-3 pb-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {(["collected", "invoiced"] as const).map((k, i) => (
          <span key={k} className="flex items-center gap-1.5 text-xs">
            <span className="h-0.5 w-3 rounded-full" style={{ background: (dark ? CAT.dark : CAT.light)[i] }} />
            <span className="text-muted-foreground">{cashConfig[k].label}</span>
            <span className="font-medium tabular-nums">{money(totals[k])}</span>
          </span>
        ))}
        <Segmented value={range} options={[3, 6, 12]} format={(n) => `${n}M`} onChange={setRange} className="ml-auto" label="Range" />
      </div>
      {empty ? (
        <Quiet>No invoices or payments in this period yet.</Quiet>
      ) : (
        <ChartContainer config={cashConfig} className={cn("aspect-auto w-full", tall ? "h-64" : "h-52")}>
          <AreaChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <defs>
              {(["collected", "invoiced"] as const).map((k) => (
                <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(--color-${k})`} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={`var(--color-${k})`} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compactINR(v)} tickCount={4} />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <Tip
                    title={String(label)}
                    rows={payload.map((p) => ({ label: String(cashConfig[p.dataKey as keyof typeof cashConfig]?.label ?? p.name), value: money(Number(p.value)), color: String(p.color) }))}
                  />
                ) : null
              }
            />
            <Area dataKey="invoiced" type="monotone" stroke="var(--color-invoiced)" strokeWidth={2} fill="url(#fill-invoiced)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
            <Area dataKey="collected" type="monotone" stroke="var(--color-collected)" strokeWidth={2} fill="url(#fill-collected)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  )
}

function Segmented<T extends string | number>({ value, options, onChange, format, className, label }: { value: T; options: T[]; onChange: (v: T) => void; format: (v: T) => string; className?: string; label: string }) {
  const id = React.useId()
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-md border bg-muted/40 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cn("relative isolate h-6 rounded px-2 text-[11px] font-medium tabular-nums transition-colors", o === value ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {o === value && <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 -z-10 rounded border bg-background shadow-xs" />}
          {format(o)}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------ ageing bar ------------------------------ */

export function AgeingChart({ ageing }: { ageing: DashboardCharts["ageing"] }) {
  const dark = useDark()
  const ramp = dark ? AGE.dark : AGE.light
  const total = AGEING.reduce((s, a) => s + ageing[a.key].amount, 0)
  const late = total - ageing.current.amount
  const [hover, setHover] = React.useState<string | null>(null)
  if (!total) return <Quiet>Nothing owed right now. Every sent invoice is paid.</Quiet>
  return (
    <div className="@container grid gap-3 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span>
          <span className="text-base font-semibold text-foreground tabular-nums">{money(total)}</span> owed
        </span>
        <span className="tabular-nums">
          <span className={cn("font-medium", late > 0 && "text-red-600 dark:text-red-400")}>{Math.round((late / total) * 100)}%</span> of it late
        </span>
      </div>
      {/* tall segmented bar: one whole split by age, 2px gaps, 4px corners */}
      <div role="img" aria-label={AGEING.map((a) => `${a.label} ${money(ageing[a.key].amount)}`).join(", ")} className="flex h-7 gap-0.5">
        {AGEING.map((a, i) =>
          ageing[a.key].amount ? (
            <motion.div
              key={a.key}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ ...spring, delay: i * 0.05 }}
              onMouseEnter={() => setHover(a.key)}
              onMouseLeave={() => setHover(null)}
              className={cn("relative origin-left rounded-[4px] transition-opacity", hover && hover !== a.key && "opacity-40")}
              style={{ flexGrow: ageing[a.key].amount, flexBasis: 0, background: ramp[i], minWidth: 6 }}
            >
              {ageing[a.key].amount / total >= 0.12 && <span className={cn("absolute inset-y-0 left-2 flex items-center text-[11px] font-medium tabular-nums", (dark ? i >= 3 : i >= 2) ? (dark ? "text-zinc-900" : "text-white") : dark ? "text-white" : "text-zinc-900")}>{Math.round((ageing[a.key].amount / total) * 100)}%</span>}
            </motion.div>
          ) : null
        )}
      </div>
      {/* two columns only when the card itself is wide enough */}
      <div className="grid gap-x-4 @lg:grid-cols-2">
        {AGEING.map((a, i) => (
          <div key={a.key} onMouseEnter={() => setHover(a.key)} onMouseLeave={() => setHover(null)}>
            <LegendRow color={ramp[i]} label={a.label} value={money(ageing[a.key].amount)} sub={`${ageing[a.key].count}`} href={a.key === "current" ? "/invoices?view=sent" : "/invoices?view=overdue"} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------- donuts -------------------------------- */

function Donut({ slices, center, sub }: { slices: { key: string; value: number; color: string; label: string; display: string }[]; center: string; sub: string }) {
  const [active, setActive] = React.useState<number | null>(null)
  const shown = slices.filter((s) => s.value > 0)
  const a = active !== null ? shown[active] : null
  return (
    <div className="relative mx-auto size-36 shrink-0">
      <ChartContainer config={{}} className="aspect-square size-36">
        <PieChart>
          <Pie
            data={shown}
            dataKey="value"
            nameKey="label"
            innerRadius={50}
            outerRadius={68}
            paddingAngle={shown.length > 1 ? 2 : 0}
            cornerRadius={4}
            stroke="none"
            onMouseEnter={(_, i) => setActive(i)}
            onMouseLeave={() => setActive(null)}
            animationDuration={700}
          >
            {shown.map((s, i) => (
              <Cell key={s.key} fill={s.color} opacity={active === null || active === i ? 1 : 0.35} className="transition-opacity" />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <span className="text-[15px] font-semibold tabular-nums">{a ? a.display : center}</span>
        <span className="max-w-20 truncate text-[11px] text-muted-foreground">{a ? a.label : sub}</span>
      </div>
    </div>
  )
}

export function StatusChart({ status }: { status: DashboardCharts["status"] }) {
  const dark = useDark()
  const total = STATUS_ORDER.reduce((s, k) => s + status[k].count, 0)
  if (!total) return <Quiet>Your invoices will show up here by status.</Quiet>
  const slices = STATUS_ORDER.map((k) => ({ key: k, value: status[k].count, color: STATUS[k][dark ? "dark" : "light"], label: STATUS[k].label, display: String(status[k].count) }))
  const view: Record<string, string> = { draft: "draft", sent: "sent", overdue: "overdue", paid: "paid", void: "void" }
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-3 sm:flex-row">
      <Donut slices={slices} center={String(total)} sub="invoices" />
      <div className="grid w-full min-w-0 flex-1">
        {STATUS_ORDER.map((k) => (
          <LegendRow key={k} color={STATUS[k][dark ? "dark" : "light"]} label={STATUS[k].label} value={String(status[k].count)} sub={status[k].count ? compactINR(status[k].amount) : "—"} href={`/invoices?view=${view[k]}`} />
        ))}
      </div>
    </div>
  )
}

export function MethodsChart({ methods }: { methods: DashboardCharts["methods"] }) {
  const dark = useDark()
  const total = methods.reduce((s, m) => s + m.amount, 0)
  if (!total) return <Quiet>Record payments on your invoices to see how clients pay.</Quiet>
  const color = (mode: (typeof PAYMENT_MODES)[number]) => (dark ? CAT.dark : CAT.light)[PAYMENT_MODES.indexOf(mode)]
  const slices = methods.map((m) => ({ key: m.mode, value: m.amount, color: color(m.mode), label: MODE_LABEL[m.mode], display: compactINR(m.amount) }))
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-3 sm:flex-row">
      <Donut slices={slices} center={compactINR(total)} sub="12 months" />
      <div className="grid w-full min-w-0 flex-1">
        {methods.map((m) => (
          <LegendRow key={m.mode} color={color(m.mode)} label={MODE_LABEL[m.mode]} value={compactINR(m.amount)} sub={`${Math.round((m.amount / total) * 100)}%`} />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------ top clients ------------------------------ */

export function TopClientsChart({ clients }: { clients: DashboardCharts["topClients"] }) {
  if (!clients.length) return <Quiet>Pick saved clients on your invoices to see who you bill most.</Quiet>
  const max = Math.max(...clients.map((c) => c.billed), 1)
  return (
    <ul className="grid gap-0.5 px-2 py-2">
      {clients.map((c, i) => {
        const row = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate font-medium">{c.name}</span>
              <span className="shrink-0 font-medium tabular-nums">{money(c.billed)}</span>
            </span>
            <span className="relative block h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.span initial={{ width: 0 }} animate={{ width: `${(c.billed / max) * 100}%` }} transition={{ ...spring, delay: i * 0.04 }} className="absolute inset-y-0 left-0 rounded-full bg-brand/80 dark:bg-[#4d8dff]" />
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {c.invoices} invoice{c.invoices === 1 ? "" : "s"}
              {c.outstanding > 0 && (
                <>
                  {" · "}
                  <span className={cn(c.overdue > 0 && "text-red-600 dark:text-red-400")}>owes {money(c.outstanding)}</span>
                </>
              )}
            </span>
          </>
        )
        return (
          <li key={c.id ?? c.name}>
            {c.id ? (
              <Link href={`/clients/${encodeURIComponent(c.id)}`} className="grid gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                {row}
              </Link>
            ) : (
              <div className="grid gap-1 px-2 py-1.5">{row}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ----------------------------- cash coming in ----------------------------- */

const forecastConfig = { due: { label: "Falling due", theme: cat(0) } } satisfies ChartConfig

export function ForecastChart({ ahead, labels }: { ahead: number[]; labels: string[] }) {
  const rows = ahead.map((due, i) => ({ due, label: labels[i] }))
  const total = ahead.reduce((s, v) => s + v, 0)
  if (!total) return <Quiet>Nothing falling due in the next 8 weeks.</Quiet>
  return (
    <div className="grid gap-1 px-4 pt-3 pb-2">
      <span className="text-xs text-muted-foreground">
        <span className="text-base font-semibold text-foreground tabular-nums">{money(total)}</span> due in 8 weeks
      </span>
      <ChartContainer config={forecastConfig} className="aspect-auto h-40 w-full">
        <BarChart data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval={1} />
          <YAxis hide />
          <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={({ active, payload }) => (active && payload?.length ? <Tip title={String(payload[0].payload.label)} rows={[{ label: "Falling due", value: money(Number(payload[0].value)) }]} /> : null)} />
          <Bar dataKey="due" fill="var(--color-due)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

/* ------------------------------ days to pay ------------------------------ */

const daysConfig = { days: { label: "Days to get paid", theme: cat(0) } } satisfies ChartConfig

export function DaysToPayChart({ data }: { data: DashboardCharts["daysToPay"] }) {
  const known = data.filter((d) => d.days !== null)
  if (!known.length) return <Quiet>Once invoices are paid in full, you&apos;ll see how long it takes.</Quiet>
  const latest = known.at(-1)!
  return (
    <div className="grid gap-1 px-4 pt-3 pb-2">
      <span className="text-xs text-muted-foreground">
        <span className="text-base font-semibold text-foreground tabular-nums">{latest.days} days</span> in {latest.label}
      </span>
      <ChartContainer config={daysConfig} className="aspect-auto h-40 w-full">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} tickCount={4} />
          <ChartTooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as (typeof data)[number] | undefined
              return active && d && d.days !== null ? <Tip title={d.label} rows={[{ label: "Average", value: `${d.days} days` }, { label: "Invoices paid", value: String(d.invoices) }]} /> : null
            }}
          />
          <Line dataKey="days" type="monotone" stroke="var(--color-days)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "var(--color-days)" }} activeDot={{ r: 5, strokeWidth: 2 }} connectNulls={false} />
        </LineChart>
      </ChartContainer>
    </div>
  )
}
