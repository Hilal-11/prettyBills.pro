"use client"

import * as React from "react"
import { useDefaultLayout, type LayoutStorage } from "react-resizable-panels"
import { EyeIcon } from "lucide-react"

import { MissingState } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { onEditorEvents } from "@/lib/client/editor-events"
import { KEYS } from "@/lib/client/local"

import { AccountDialog } from "./account-dialog"
import { WorkspaceSkeleton } from "./workspace-skeleton"
import { Segmented } from "./fields"
import { EditPanel } from "./panel"
import { Preview } from "./preview"
import { SendDialog } from "./send-dialog"
import { useToast } from "./toast"
import { TopBar } from "./toolbar"
import { useEditor, type View } from "./use-editor"

/** localStorage that never throws (private mode, quota). */
const safeStorage: LayoutStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {}
  },
}

/**
 * The invoice editor. Without `invoiceId` it starts a new invoice (with an
 * optional template or client picked); with one, it opens that invoice.
 */
export function InvoiceWorkspace({ invoiceId, templateId, clientId }: { invoiceId?: string; templateId?: string; clientId?: string }) {
  const ed = useEditor({ invoiceId, templateId, clientId })
  const toast = useToast()
  const wide = useMinWidth(1024)
  const [sendOpen, setSendOpen] = React.useState(false)
  const [previewModal, setPreviewModal] = React.useState(false)
  const [narrowTab, setNarrowTab] = React.useState<"form" | "preview">("form")
  const split = useDefaultLayout({ id: KEYS.split, storage: safeStorage, panelIds: ["preview", "editor"] })

  const requestSend = React.useCallback(() => {
    if (ed.guest) return ed.askAccount("send")
    const v = ed.validation
    if (v.requiredMissing > 0 && v.firstInvalid) {
      ed.setShowAllErrors(true)
      if (!wide) setNarrowTab("form")
      else if (ed.view === "preview") ed.setView("both")
      ed.focusSection(v.firstInvalid.section, v.firstInvalid.field)
      toast({ title: `Fill ${v.requiredMissing} required field${v.requiredMissing === 1 ? "" : "s"} before sending.`, tone: "error" })
      return
    }
    setSendOpen(true)
  }, [ed, toast, wide])

  const saveDraft = React.useCallback(() => {
    if (ed.guest) return ed.askAccount("save")
    ed.retrySave()
    toast({ title: "Draft saved", tone: "success", duration: 2500 })
  }, [ed, toast])

  // a guest's invoice arriving in their new account, or coming back from the login page
  const { adopted, restored } = ed
  React.useEffect(() => {
    if (adopted) toast({ title: "Saved to your account", description: "The invoice you made as a guest is now in your drafts.", tone: "success", duration: 5000 })
    else if (restored) toast({ title: "Your invoice is back", description: "Still not saved. Log in any time to keep it.", duration: 4000 })
  }, [adopted, restored, toast])

  // settings → editor: "also update the invoice I'm editing" and the default layout
  React.useEffect(
    () =>
      onEditorEvents({
        business: (b) => {
          ed.update((d) => {
            d.from = { ...b, logo: d.from.logo ?? b.logo }
            if (b.gstin && d.title === "Bill of Supply") d.title = "Tax Invoice"
          }, "from")
          toast({ title: "Business details updated on this invoice", tone: "success", duration: 2500 })
        },
        view: (v) => {
          if (wide) ed.setView(v)
          else setNarrowTab(v === "preview" ? "preview" : "form")
        },
      }),
    [ed, toast, wide]
  )

  // keyboard: Alt+1/2/3 views, Ctrl+S save, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y history
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault()
        const map: Record<string, View> = { "1": "form", "2": "preview", "3": "both" }
        if (wide) ed.setView(map[e.key])
        else setNarrowTab(e.key === "2" ? "preview" : "form")
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === "s" && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        saveDraft()
      } else if (key === "z" && !e.shiftKey) {
        e.preventDefault()
        ed.undo()
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault()
        ed.redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [ed, wide, saveDraft])

  if (!ed.ready) return <WorkspaceSkeleton />
  if (ed.notFound) return <EditorNotFound />

  const panel = <EditPanel ed={ed} onSend={requestSend} onSaveDraft={saveDraft} />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar ed={ed} wide={wide} onSend={requestSend} />

      {wide ? (
        ed.view === "both" ? (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" defaultLayout={split.defaultLayout} onLayoutChanged={split.onLayoutChanged}>
            <ResizablePanel id="preview" defaultSize="55%" minSize={420}>
              <Preview ed={ed} />
            </ResizablePanel>
            <ResizableHandle withHandle className="transition-colors hover:bg-brand/40 data-[separator=active]:bg-brand" />
            <ResizablePanel id="editor" defaultSize="45%" minSize={400}>
              {panel}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : ed.view === "form" ? (
          <div className="relative min-h-0 flex-1">
            <EditPanel ed={ed} onSend={requestSend} onSaveDraft={saveDraft} wide />
            <Button variant="outline" className="absolute right-6 bottom-20 h-9 gap-1.5 rounded-full bg-background px-4 text-[13px] shadow-lg" onClick={() => setPreviewModal(true)}>
              <EyeIcon /> Preview
            </Button>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <Preview ed={ed} />
          </div>
        )
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex justify-center border-b p-2">
            <Segmented
              label="View"
              layoutId="narrow-view"
              value={narrowTab}
              options={[
                { value: "form", label: "Form" },
                { value: "preview", label: "Preview" },
              ]}
              onChange={setNarrowTab}
            />
          </div>
          <div className="min-h-0 flex-1">{narrowTab === "form" ? panel : <Preview ed={ed} interactive={false} />}</div>
        </div>
      )}

      <Dialog open={previewModal} onOpenChange={setPreviewModal}>
        <DialogContent className="h-[90dvh] max-w-[min(92vw,900px)] gap-0 overflow-hidden p-0 sm:max-w-[min(92vw,900px)]">
          <DialogTitle className="sr-only">Invoice preview</DialogTitle>
          <Preview ed={ed} interactive={false} />
        </DialogContent>
      </Dialog>

      <SendDialog ed={ed} open={sendOpen} onOpenChange={setSendOpen} />
      {ed.guest && <AccountDialog ed={ed} />}
    </div>
  )
}

function EditorNotFound() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <SidebarTrigger className="-ml-1 text-foreground/70" />
      </div>
      <MissingState title="We couldn't find that invoice" body="It may have been deleted, or it belongs to a different account. Check you're logged in as the right person." back={{ label: "Back to invoices", href: "/invoices" }} />
    </div>
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
