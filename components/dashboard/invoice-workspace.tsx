"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CloudCheckIcon, DownloadIcon, LoaderIcon, Redo2Icon, SendIcon, Undo2Icon } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { InvoiceCanvas } from "./invoice-canvas"
import { InvoiceEditor } from "./invoice-editor"
import { ease, spring } from "@/lib/motion"
import { useInvoiceDraft } from "./use-invoice-draft"

/** The invoice workspace: top bar + canvas (70%) and editor (30%). */
export function InvoiceWorkspace() {
  const api = useInvoiceDraft()
  const wide = useMinWidth(1024)
  const [mobileView, setMobileView] = React.useState<"edit" | "preview">("edit")

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar paid={api.draft.paid || api.draft.kind === "receipt"} saving={api.saving} number={api.draft.number} />

      {wide ? (
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize="70%" minSize="45%">
            <InvoiceCanvas api={api} />
          </ResizablePanel>
          <ResizableHandle withHandle className="transition-colors hover:bg-brand/40 data-[separator=active]:bg-brand" />
          <ResizablePanel defaultSize="30%" minSize={340} maxSize="45%">
            <InvoiceEditor api={api} />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex justify-center border-b p-2">
            <div role="tablist" aria-label="View" className="flex rounded-lg border bg-muted/50 p-0.5">
              {(["edit", "preview"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={mobileView === v}
                  onClick={() => setMobileView(v)}
                  className={cn(
                    "relative isolate rounded-md px-4 py-1 text-xs capitalize transition-colors",
                    mobileView === v ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {mobileView === v && <motion.span layoutId="mobile-view" transition={spring} className="absolute inset-0 -z-10 rounded-md bg-background shadow-xs" />}
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1">{mobileView === "edit" ? <InvoiceEditor api={api} /> : <InvoiceCanvas api={api} />}</div>
        </div>
      )}
    </div>
  )
}

function TopBar({ paid, saving, number }: { paid: boolean; saving: boolean; number: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger className="-ml-1 text-muted-foreground" />
      <Separator orientation="vertical" className="mr-1 h-4 data-vertical:self-center" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap text-[13px]">
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink href="#">Invoices</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:inline-flex" />
          <BreadcrumbItem className="hidden md:inline-flex">
            <BreadcrumbLink href="#">Drafts</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:inline-flex" />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-semibold tabular-nums">{number || "Untitled"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <span
        className={cn(
          "ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
          paid ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
        )}
      >
        <span className={cn("size-1.5 rounded-full", paid ? "bg-emerald-500" : "bg-amber-500")} />
        {paid ? "Paid" : "Draft"}
      </span>

      <span className="hidden items-center gap-1 text-[11px] text-muted-foreground md:inline-flex" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={saving ? "saving" : "saved"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease }}
            className="inline-flex items-center gap-1"
          >
            {saving ? <LoaderIcon className="size-3 animate-spin" /> : <CloudCheckIcon className="size-3.5" />}
            {saving ? "Saving…" : "Saved"}
          </motion.span>
        </AnimatePresence>
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden items-center lg:flex">
          <Button variant="ghost" size="icon-sm" aria-label="Undo" className="text-muted-foreground">
            <Undo2Icon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Redo" className="text-muted-foreground">
            <Redo2Icon />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="hidden h-8 text-[13px] sm:inline-flex">
          <DownloadIcon /> PDF
        </Button>
        <Button variant="outline" size="sm" className="hidden h-8 text-[13px] sm:inline-flex">
          <FaWhatsapp className="text-emerald-600 dark:text-emerald-400" /> Share
        </Button>
        <Button size="sm" className="h-8 text-[13px]">
          <SendIcon /> Send invoice
        </Button>
      </div>
    </header>
  )
}

/** true once the viewport is at least `px` wide (assumes desktop before hydration). */
function useMinWidth(px: number) {
  const [matches, setMatches] = React.useState(true)
  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${px}px)`)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [px])
  return matches
}
