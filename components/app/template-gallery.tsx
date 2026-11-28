"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon } from "lucide-react"
import { cn } from "cn"

import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { CATEGORY_ORDER, TEMPLATES, type TemplateMeta } from "@/lib/invoice/templates"
import { spring } from "@/lib/motion"

/**
 * /templates, edge to edge: category tabs, then every template in a grid of
 * hairline cells. Thumbnails are rendered on the server (the same component
 * the editor and PDFs use) and passed in, so the page ships almost no JS.
 * The preview steps through templates with the arrow keys.
 */
export function TemplateGallery({ thumbs }: { thumbs: Record<string, React.ReactNode> }) {
  const [category, setCategory] = React.useState<string>("All")
  const [size, setSize] = React.useState<"all" | "a4" | "80mm">("all")
  const [preview, setPreview] = React.useState<TemplateMeta | null>(null)
  const categories = ["All", ...CATEGORY_ORDER.filter((c) => TEMPLATES.some((t) => t.category === c))]
  const shown = TEMPLATES.filter((t) => (category === "All" || t.category === category) && (size === "all" || t.size === size))
  const count = (c: string) => TEMPLATES.filter((t) => (c === "All" || t.category === c) && (size === "all" || t.size === size)).length

  const step = (dir: 1 | -1) => {
    if (!preview) return
    const i = shown.findIndex((t) => t.slug === preview.slug)
    setPreview(shown[(i + dir + shown.length) % shown.length])
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
        <nav aria-label="Categories" className="-mx-1 max-w-full overflow-x-auto px-1">
          <ul className="flex items-center gap-0.5">
            {categories.map((c) => {
              const on = c === category
              return (
                <li key={c}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCategory(c)}
                    className={cn("relative isolate inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors", on ? "font-medium text-foreground" : "text-foreground/60 hover:text-foreground")}
                  >
                    {on && <motion.span layoutId="template-cat" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-muted/70" />}
                    {c}
                    <span className="text-xs text-muted-foreground tabular-nums">{count(c)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <div role="radiogroup" aria-label="Paper size" className="ml-auto inline-flex rounded-lg border bg-muted/40 p-0.5">
          {(
            [
              ["all", "All sizes"],
              ["a4", "A4"],
              ["80mm", "Thermal 80mm"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={size === v}
              onClick={() => setSize(v)}
              className={cn("relative isolate h-7 rounded-md px-2.5 text-xs font-medium transition-colors", size === v ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {size === v && <motion.span layoutId="template-size" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <ul className="-mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((t) => {
              const Icon = t.icon
              return (
                <motion.li key={t.slug} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring} className="group flex flex-col border-r border-b bg-background">
                  <button
                    type="button"
                    onClick={() => setPreview(t)}
                    aria-label={`Preview ${t.name}`}
                    className="relative block overflow-hidden bg-muted/40 px-6 pt-6 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset dark:bg-black/25"
                  >
                    <span
                      className={cn(
                        "mx-auto block h-56 overflow-hidden rounded-t-[3px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.07),0_10px_24px_-14px_rgb(0_0_0/0.3)] transition-transform duration-300 ease-out group-hover:-translate-y-1",
                        t.size === "80mm" ? "w-[42%]" : "w-[74%]"
                      )}
                    >
                      {thumbs[t.slug]}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-muted/60 to-transparent dark:from-black/30" />
                    <span className="absolute top-2.5 right-2.5 inline-flex h-6 items-center gap-1 rounded-md border bg-background/90 px-1.5 text-[11px] font-medium text-foreground/80 opacity-0 shadow-xs backdrop-blur transition-opacity group-hover:opacity-100">
                      <EyeIcon className="size-3" /> Preview
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col gap-1.5 border-t px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <h3 className="truncate text-[13px] font-semibold">{t.name}</h3>
                      {t.recommended && <span className="rounded bg-brand/10 px-1.5 py-px text-[10px] font-medium text-brand dark:bg-brand/20 dark:text-[#6da2ff]">Recommended</span>}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{t.category}</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                    <div className="mt-auto flex items-center gap-1 pt-1.5">
                      {t.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded border px-1.5 py-px text-[10px] text-foreground/65">
                          {tag}
                        </span>
                      ))}
                      <Link href={`/create?template=${t.slug}`} className={cn(buttonVariants({ variant: "outline" }), "group/use ml-auto h-7 gap-1 px-2.5 text-xs hover:border-brand/40 hover:bg-brand hover:text-white")}>
                        Use <ArrowRightIcon className="size-3 transition-transform group-hover/use:translate-x-0.5" />
                      </Link>
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent
          className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-[min(92vw,760px)]"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1)
            if (e.key === "ArrowLeft") step(-1)
          }}
        >
          {preview && (
            <>
              <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 pr-12">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Previous template" onClick={() => step(-1)}>
                    <ChevronLeftIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Next template" onClick={() => step(1)}>
                    <ChevronRightIcon />
                  </Button>
                  <div className="ml-1 grid gap-0.5">
                    <DialogTitle className="text-[14px] font-semibold">{preview.name}</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">{preview.description}</DialogDescription>
                  </div>
                </div>
                <Link href={`/create?template=${preview.slug}`} className={cn(buttonVariants(), "h-7 shrink-0 gap-1 px-2.5 text-xs")}>
                  Use template <ArrowRightIcon className="size-3" />
                </Link>
              </div>
              <div className="max-h-[calc(92dvh-56px)] overflow-y-auto bg-muted/50 p-6 dark:bg-black/30">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={preview.slug}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className={cn("mx-auto overflow-hidden rounded-[4px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_24px_48px_-24px_rgb(0_0_0/0.35)]", preview.size === "80mm" ? "max-w-[320px]" : "max-w-[640px]")}
                  >
                    {thumbs[preview.slug]}
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
