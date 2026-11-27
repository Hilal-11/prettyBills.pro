import { CheckIcon, MinusIcon } from "lucide-react"

import { ProBadge } from "@/components/app/premium"

import { COMPARE, type Cell } from "./content"

function Value({ cell, pro }: { cell: Cell; pro?: boolean }) {
  if (cell === true) return <CheckIcon aria-label="Included" className={pro ? "mx-auto size-4 text-brand dark:text-[#6da2ff]" : "mx-auto size-4 text-foreground/70"} />
  if (cell === false) return <MinusIcon aria-label="Not included" className="mx-auto size-4 text-muted-foreground/50" />
  if (cell === "Soon") return <span className="rounded border px-1.5 py-px text-[11px] text-muted-foreground">Soon</span>
  return <span className="text-[13px] font-medium">{cell}</span>
}

/** Free and Pro side by side. Monthly and yearly Pro are the same plan, so they share a column. */
export function CompareTable() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">What Free and Pro include</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="px-4 py-3 text-[13px] font-medium text-muted-foreground sm:px-6">
              Feature
            </th>
            <th scope="col" className="w-24 px-2 py-3 text-center text-[13px] font-semibold sm:w-40">
              Free
            </th>
            <th scope="col" className="w-28 px-2 py-3 text-center sm:w-40">
              <ProBadge className="text-[11px]" />
            </th>
          </tr>
        </thead>
        {COMPARE.map((group) => (
          <tbody key={group.group}>
            <tr>
              <th scope="colgroup" colSpan={3} className="border-b bg-muted/20 px-4 pt-5 pb-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase sm:px-6">
                {group.group}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-b last:border-b-0 hover:bg-muted/30">
                <th scope="row" className="px-4 py-2.5 text-[13.5px] font-normal text-foreground/85 sm:px-6">
                  {row.label}
                </th>
                <td className="px-2 py-2.5 text-center">
                  <Value cell={row.free} />
                </td>
                <td className="bg-brand/[0.03] px-2 py-2.5 text-center dark:bg-brand/[0.06]">
                  <Value cell={row.pro} pro />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
