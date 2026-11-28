"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * A 12-point trend for a stat tile: a 2px line in a recessive ink, with the
 * latest point picked out in the tile's accent. Hovering (or focusing) reads
 * out each point (`shown`, already formatted on the server); the tile's own
 * number is the headline, so no axes.
 */
export function Sparkline({ values, labels, shown, accent = "fill-brand", className, label }: { values: number[]; labels: string[]; shown: string[]; accent?: string; className?: string; label: string }) {
  const [hover, setHover] = React.useState<number | null>(null)
  const W = 112
  const H = 32
  const pad = 4
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, values.length - 1)
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2)
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")
  const last = values.length - 1
  const at = hover ?? last

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`${label}: ${labels[0]} ${shown[0]} to ${labels[last]} ${shown[last]}`}
        className="overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-foreground/20" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="stroke-foreground/15" strokeWidth={1} />}
        <circle cx={x(at)} cy={y(values[at] ?? 0)} r={3.5} className={cn("stroke-background", accent)} strokeWidth={2} />
        {/* hit areas wider than the marks */}
        {values.map((_, i) => (
          <rect key={i} x={x(i) - (W - pad * 2) / Math.max(1, last) / 2} y={0} width={(W - pad * 2) / Math.max(1, last)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <span className="pointer-events-none absolute top-full right-0 z-30 mt-1 rounded-md border bg-popover px-2 py-1 text-[11px] whitespace-nowrap text-popover-foreground shadow-md tabular-nums">
          <span className="text-muted-foreground">{labels[hover]}</span> <span className="font-medium">{shown[hover]}</span>
        </span>
      )}
    </div>
  )
}
