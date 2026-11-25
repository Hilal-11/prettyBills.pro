"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRightIcon, MaximizeIcon } from "lucide-react"
import { cn } from "cn"

import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { CATEGORY_ORDER, TEMPLATES, type TemplateMeta } from "@/lib/invoice/templates"
import { spring } from "@/lib/motion"

/**
 * /templates. Thumbnails are rendered on the server (the same component the
 * editor and PDFs use) and passed in, so the page ships almost no JS.
 */
export function TemplateGallery({ thumbs }: { thumbs: Record<string, React.ReactNode> }) {
  const [category, setCategory] = React.useState<string>("All")
  const [preview, setPreview] = React.useState<TemplateMeta | null>(null)
  const categories = ["All", ...CATEGORY_ORDER.filter((c) => TEMPLATES.some((t) => t.category === c))]
  const shown = category === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === category)

  return (
    <>
      <div role="tablist" aria-label="Categories" className="-mx-1 mb-5 flex gap-0.5 overflow-x-auto px-1">
        <div className="inline-flex gap-0.5 rounded-lg border bg-muted/50 p-0.5">
          {categories.map((c) => {
            const on = c === category
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setCategory(c)}
                className={cn("relative isolate inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors", on ? "text-foreground" : "text-foreground/60 hover:text-foreground")}
              >
                {on && <motion.span layoutId="template-cat" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
                {c}
              </button>
            )
          })}
        </div>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((t) => {
          const Icon = t.icon
          return (
            <motion.li key={t.slug} layout transition={spring} className="group flex flex-col overflow-hidden rounded-xl border bg-background">
              <button
                type="button"
                onClick={() => setPreview(t)}
                aria-label={`Preview ${t.name}`}
                className="relative block overflow-hidden border-b bg-muted/50 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset dark:bg-black/30"
              >
                <span className={cn("mx-auto block overflow-hidden rounded-[3px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_12px_28px_-16px_rgb(0_0_0/0.35)] transition-transform duration-300 group-hover:-translate-y-0.5", t.size === "80mm" ? "w-[46%]" : "w-[78%]")}>
                  <span className={cn("block", t.size === "80mm" ? "max-h-64 overflow-hidden" : "")}>{thumbs[t.slug]}</span>
                </span>
                <span className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-md border bg-background/90 opacity-0 shadow-xs transition-opacity group-hover:opacity-100">
                  <MaximizeIcon className="size-3.5" />
                </span>
              </button>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-foreground/60" />
                  <h3 className="text-[14px] font-semibold">{t.name}</h3>
                  {t.recommended && <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand dark:bg-brand/20 dark:text-[#6da2ff]">Recommended</span>}
                  <span className="ml-auto text-[11px] text-muted-foreground">{t.category}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{t.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.tags.map((tag) => (
                    <span key={tag} className="rounded border px-1.5 text-[10px] text-foreground/70">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex gap-2 pt-4">
                  <Link href={`/create?template=${t.slug}`} className={cn(buttonVariants(), "h-8 flex-1 gap-1.5 text-[13px]")}>
                    Use template <ArrowRightIcon className="size-3.5" />
                  </Link>
                  <Button variant="outline" className="h-8 text-[13px]" onClick={() => setPreview(t)}>
                    Preview
                  </Button>
                </div>
              </div>
            </motion.li>
          )
        })}
      </ul>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-[min(92vw,760px)]">
          {preview && (
            <>
              <div className="flex items-center justify-between gap-3 border-b px-5 py-3 pr-12">
                <div className="grid gap-0.5">
                  <DialogTitle className="text-[15px] font-semibold">{preview.name}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">{preview.description}</DialogDescription>
                </div>
                <Link href={`/create?template=${preview.slug}`} className={cn(buttonVariants(), "h-8 shrink-0 gap-1.5 px-3 text-[13px]")}>
                  Use template <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
              <div className="max-h-[calc(92dvh-64px)] overflow-y-auto bg-muted/50 p-6 dark:bg-black/30">
                <div className={cn("mx-auto overflow-hidden rounded-[4px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_24px_48px_-24px_rgb(0_0_0/0.35)]", preview.size === "80mm" ? "max-w-[320px]" : "max-w-[640px]")}>
                  {thumbs[preview.slug]}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
