import type { BusinessSnapshot } from "@/lib/invoice/types"

/**
 * Settings talk to the open invoice editor through window events, so neither
 * has to know about the other. The editor listens; settings dispatch.
 */
const BUSINESS = "pb:apply-business"
const VIEW = "pb:editor-view"

export type EditorView = "form" | "preview" | "both"

export function applyBusinessToEditor(business: BusinessSnapshot) {
  window.dispatchEvent(new CustomEvent(BUSINESS, { detail: business }))
}

export function setEditorView(view: EditorView) {
  window.dispatchEvent(new CustomEvent(VIEW, { detail: view }))
}

/** For the editor: subscribe to both. Returns an unsubscribe function. */
export function onEditorEvents(handlers: { business: (b: BusinessSnapshot) => void; view: (v: EditorView) => void }) {
  const onBusiness = (e: Event) => handlers.business((e as CustomEvent<BusinessSnapshot>).detail)
  const onView = (e: Event) => handlers.view((e as CustomEvent<EditorView>).detail)
  window.addEventListener(BUSINESS, onBusiness)
  window.addEventListener(VIEW, onView)
  return () => {
    window.removeEventListener(BUSINESS, onBusiness)
    window.removeEventListener(VIEW, onView)
  }
}
