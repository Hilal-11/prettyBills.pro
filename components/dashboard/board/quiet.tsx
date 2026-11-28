/** The empty state inside a chart card. Kept apart from the charts so it doesn't pull in the chart library. */
export function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="grid h-full min-h-32 place-items-center px-6 text-center text-[13px] text-muted-foreground">{children}</p>
}
