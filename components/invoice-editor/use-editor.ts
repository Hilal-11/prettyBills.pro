"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { produce } from "immer"

import { idb } from "@/lib/client/idb"
import { KEYS, readLocal, writeLocal } from "@/lib/client/local"
import { clearGuestWork, peekGuestWork, registerGuestWork } from "@/lib/client/handoff"
import { claimLocalData } from "@/lib/client/owner"
import { LIMITS } from "@/lib/invoice/config"
import { EMPTY_SETTINGS, type WorkspaceSettings } from "@/lib/data/types"
import { fetchWorkspace, importLocalData, invoicesChanged, onSettingsChanged, saveClientRemote, saveItemRemote, saveSettingsRemote } from "@/lib/client/workspace"
import { createBlankInvoice, createInvoice, partyFromClient, SEED_BUSINESS, SEED_CATALOG, SEED_CLIENTS, type CatalogItem, type Client } from "@/lib/invoice/defaults"
import { localDateToISO, nextInvoiceNumber, uid } from "@/lib/invoice/format"
import { computeInvoiceTotals } from "@/lib/invoice/totals"
import type { Invoice } from "@/lib/invoice/types"
import { validateInvoice, type SectionId } from "@/lib/invoice/validate"
import { createClient } from "@/lib/supabase/client"

export type View = "form" | "preview" | "both"
export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error" | "guest"
/** Why a guest is being asked to log in; changes the prompt's wording. */
export type AccountReason = "save" | "send" | "share" | "default"

type History = { past: Invoice[]; present: Invoice; future: Invoice[]; lastKey?: string; lastAt: number }

// Deterministic placeholder for the first render (no Date/random during prerender).
const PLACEHOLDER = createInvoice({ id: "placeholder", today: "2026-11-01", counter: 15 })

/** What to open: an existing invoice, or a new one (optionally with a template or client picked). */
export type EditorOptions = { invoiceId?: string; templateId?: string; clientId?: string }

/** Settings defaults applied to a fresh invoice. */
function applyDefaults(inv: Invoice, settings: WorkspaceSettings): Invoice {
  return {
    ...inv,
    payment: settings.payment ? { ...inv.payment, ...settings.payment, amountPaid: 0 } : inv.payment,
    terms: settings.terms ?? inv.terms,
    signature: settings.signature ?? inv.signature,
  }
}

function withClient(inv: Invoice, client: Client | undefined): Invoice {
  if (!client) return inv
  return { ...inv, clientId: client.id, billTo: partyFromClient(client), placeOfSupply: client.address.stateCode || inv.placeOfSupply }
}

export function useEditor(opts: EditorOptions = {}) {
  const router = useRouter()
  // read once: the boot decides what to open; later URL changes don't reload the editor
  const [boot] = React.useState(opts)
  const [ready, setReady] = React.useState(false)
  const [hist, setHist] = React.useState<History>({ past: [], present: PLACEHOLDER, future: [], lastAt: 0 })
  const invoice = hist.present

  const [save, setSave] = React.useState<{ status: SaveStatus; savedAt?: number; error?: string }>({ status: "idle" })
  const [serverDirty, setServerDirty] = React.useState(false)
  const [takenNumbers, setTakenNumbers] = React.useState<string[]>([])
  const [clients, setClients] = React.useState<Client[]>(SEED_CLIENTS)
  const [catalog, setCatalog] = React.useState<CatalogItem[]>(SEED_CATALOG)
  const [confirmAccount, setConfirmAccount] = React.useState<string | undefined>(undefined)
  const [touched, setTouched] = React.useState<Set<string>>(new Set())
  const [showAllErrors, setShowAllErrors] = React.useState(false)
  const [open, setOpen] = React.useState<Set<SectionId>>(new Set(["items"]))
  const [highlight, setHighlightState] = React.useState<SectionId | null>(null)
  const [view, setViewState] = React.useState<View>("both")
  const [revisionBumped, setRevisionBumped] = React.useState(false)
  // Guests (signed out) get the full editor, kept in memory only: nothing is
  // written to this browser or the server.
  const [guest, setGuest] = React.useState(false)
  const guestRef = React.useRef(false)
  const [adopted, setAdopted] = React.useState(false)
  const [restored, setRestored] = React.useState(false)
  const [accountPrompt, setAccountPrompt] = React.useState<AccountReason | null>(null)
  /** Signed-in defaults: business, payment, terms and signature. */
  const [defaults, setDefaults] = React.useState<WorkspaceSettings>(EMPTY_SETTINGS)
  /** The invoice in the URL doesn't exist (or isn't yours). */
  const [notFound, setNotFound] = React.useState(false)
  /** Not saved yet: the URL moves from /create to /invoices/<id> on the first save. */
  const isNew = React.useRef(!opts.invoiceId)
  /** Loaded with edits the server hasn't seen (a guest's work, or an offline draft): save once ready. */
  const bootDirty = React.useRef(false)
  const sectionRefs = React.useRef(new Map<SectionId, HTMLElement>())
  const highlightTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ------------------------------ load ------------------------------ */
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { invoiceId, templateId, clientId } = boot
      const { data: auth } = await createClient().auth.getSession()
      // work a guest brought along when they chose to log in (or came back from the login page)
      const handoff = invoiceId ? null : peekGuestWork()
      const today = localDateToISO(new Date())
      const savedView = readLocal<View>(KEYS.view, "both")

      if (!auth.session) {
        if (cancelled) return
        // cleared only by a run that uses it (dev StrictMode runs this effect twice)
        if (handoff) clearGuestWork()
        guestRef.current = true
        setGuest(true)
        const sample = createInvoice({ id: uid("inv"), today, counter: 1, business: SEED_BUSINESS })
        setHist({ past: [], present: handoff?.invoice ?? { ...sample, templateId: templateId || sample.templateId }, future: [], lastAt: 0 })
        if (handoff) {
          setClients(handoff.clients.length ? handoff.clients : SEED_CLIENTS)
          setCatalog(handoff.catalog.length ? handoff.catalog : SEED_CATALOG)
          setRestored(true)
        }
        setViewState(savedView)
        setSave({ status: "guest" })
        setReady(true)
        return
      }

      // unsynced drafts in this browser belong to the signed-in account; another account's are cleared first
      await claimLocalData(auth.session.user.id)
      const fetched = await fetchWorkspace()
      const ws = fetched ? await importLocalData(fetched) : null
      const settings = ws?.settings ?? EMPTY_SETTINGS
      const numbers = ws?.numbers ?? []
      const number = nextInvoiceNumber(numbers.map((x) => x.number), today)
      const fresh = (id: string) => ({ ...applyDefaults(createBlankInvoice({ id, today, counter: 1, business: settings.business ?? undefined }), settings), number })

      let loaded: Invoice | null = null
      let dirty = false
      if (handoff) {
        const work = handoff.invoice
        // a guest numbers from 001; don't collide with numbers this account already used
        loaded = numbers.some((x) => x.number === work.number && x.id !== work.id) ? { ...work, number: fresh(work.id).number } : work
        dirty = true
      } else if (invoiceId) {
        // edits that never reached the server (offline, closed tab) win over the server copy
        const pending = await idb.get<Invoice>(`invoice:${invoiceId}`)
        const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`).catch(() => null)
        const server = res?.ok ? ((await res.json()) as { invoice: Invoice }).invoice : null
        if (pending) {
          loaded = server ? { ...pending, status: server.status, publicToken: server.publicToken, sentAt: server.sentAt, linkActive: server.linkActive } : pending
          dirty = true
        } else loaded = server
        if (!loaded) {
          if (cancelled) return
          setNotFound(true)
          setReady(true)
          return
        }
      } else {
        const blank = fresh(uid("inv"))
        loaded = withClient({ ...blank, templateId: templateId || blank.templateId }, ws?.clients.find((c) => c.id === clientId))
      }
      if (cancelled) return
      if (handoff) clearGuestWork()
      const opened = loaded
      bootDirty.current = dirty
      setHist({ past: [], present: opened, future: [], lastAt: 0 })
      setTakenNumbers(numbers.filter((x) => x.id !== opened.id).map((x) => x.number))
      setClients(ws?.clients ?? [])
      setCatalog(ws?.items ?? [])
      setDefaults(settings)
      setViewState(savedView)
      setSave(dirty ? { status: "saving" } : isNew.current ? { status: "idle" } : { status: "saved", savedAt: Date.now() })
      setServerDirty(dirty)
      setAdopted(!!handoff)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [boot])

  /* ----------------------------- editing ---------------------------- */
  const update = React.useCallback(
    (recipe: (draft: Invoice) => void, key?: string) => {
      setHist((h) => {
        const next = produce(h.present, recipe)
        if (next === h.present) return h
        const now = Date.now()
        const coalesce = key && key === h.lastKey && now - h.lastAt < 1200
        return {
          past: coalesce ? h.past : [...h.past, h.present].slice(-LIMITS.historySteps),
          present: next,
          future: [],
          lastKey: key,
          lastAt: now,
        }
      })
    },
    []
  )

  const undo = React.useCallback(() => {
    setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastAt: 0 } : h))
  }, [])
  const redo = React.useCallback(() => {
    setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), lastAt: 0 } : h))
  }, [])

  // Editing a sent invoice creates a revised version (once per session).
  React.useEffect(() => {
    if (!ready || !invoice.sentAt || revisionBumped || hist.past.length === 0) return
    setRevisionBumped(true)
    update((d) => {
      d.revision = (d.revision ?? 1) + 1
    })
  }, [ready, invoice.sentAt, revisionBumped, hist.past.length, update])

  /* ---------------------------- autosave ---------------------------- */
  const latest = React.useRef(invoice)
  React.useEffect(() => {
    latest.current = invoice
  }, [invoice])

  const saveNow = React.useCallback(async (inv: Invoice) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSave((s) => ({ ...s, status: "offline" }))
      return
    }
    setSave((s) => ({ ...s, status: "saving" }))
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ invoice: inv }) })
      if (res.status === 401) {
        // session ended: the draft is already in IndexedDB, so log in and pick up where you left off
        router.replace(`/login?next=${encodeURIComponent(`/invoices/${inv.id}`)}`)
        return
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string; status?: Invoice["status"] }
      if (!res.ok) throw Object.assign(new Error(body.error ?? `Error ${res.status}`), { http: true })
      setSave({ status: "saved", savedAt: Date.now() })
      setServerDirty(false)
      // the server is up to date: drop the offline copy, unless there are newer edits
      if (latest.current === inv) void idb.del(`invoice:${inv.id}`)
      // paid / part paid follow the amount received
      const stored = body.status
      if (stored && stored !== inv.status) setHist((h) => ({ ...h, present: { ...h.present, status: stored } }))
      if (isNew.current) {
        // saved for the first time: give it its own address, so a reload opens it again
        isNew.current = false
        window.history.replaceState(null, "", `/invoices/${inv.id}`)
        invoicesChanged()
      } else if (stored && stored !== inv.status) invoicesChanged()
    } catch (error) {
      const http = (error as { http?: boolean }).http
      setSave((s) => ({ ...s, status: http ? "error" : "offline", error: (error as Error).message }))
    }
  }, [router])

  // a guest's invoice that just arrived, or offline edits: save them right away
  React.useEffect(() => {
    if (!ready || !bootDirty.current) return
    bootDirty.current = false
    void idb.set(`invoice:${invoice.id}`, invoice)
    void saveNow(invoice)
  }, [ready, invoice, saveNow])

  const firstRun = React.useRef(true)
  React.useEffect(() => {
    if (!ready || guest || notFound) return
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setServerDirty(true)
    const local = setTimeout(() => void idb.set(`invoice:${invoice.id}`, invoice), 250)
    const remote = setTimeout(() => void saveNow(invoice), 800)
    return () => {
      clearTimeout(local)
      clearTimeout(remote)
    }
  }, [invoice, ready, guest, notFound, saveNow])

  React.useEffect(() => {
    const online = () => serverDirty && void saveNow(latest.current)
    const offline = () => setSave((s) => ({ ...s, status: "offline" }))
    window.addEventListener("online", online)
    window.addEventListener("offline", offline)
    return () => {
      window.removeEventListener("online", online)
      window.removeEventListener("offline", offline)
    }
  }, [serverDirty, saveNow])

  // guests: warn before closing the tab once they've typed something, since nothing is kept
  const unsaved = guest ? hist.past.length > 0 || restored : serverDirty
  React.useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [unsaved])

  // what a guest hands over if they choose to log in (only once they've changed something)
  const snapshot = React.useRef({ invoice, clients, catalog, edited: false })
  React.useEffect(() => {
    snapshot.current = { invoice, clients, catalog, edited: hist.past.length > 0 || restored }
  }, [invoice, clients, catalog, hist.past.length, restored])
  React.useEffect(() => {
    if (!guest) return
    return registerGuestWork(() => snapshot.current)
  }, [guest])

  const askAccount = React.useCallback((reason: AccountReason = "default") => setAccountPrompt(reason), [])
  const closeAccountPrompt = React.useCallback(() => setAccountPrompt(null), [])

  const retrySave = React.useCallback(() => {
    if (!guestRef.current) void saveNow(latest.current)
  }, [saveNow])

  /* -------------------------- derived values ------------------------ */
  const totals = React.useMemo(() => computeInvoiceTotals(invoice), [invoice])
  const validation = React.useMemo(() => validateInvoice(invoice, { takenNumbers, confirmAccount }), [invoice, takenNumbers, confirmAccount])

  const touch = React.useCallback((path: string) => setTouched((t) => (t.has(path) ? t : new Set(t).add(path))), [])
  const errorFor = React.useCallback(
    (path: string) => (showAllErrors || touched.has(path) ? validation.errors[path] : undefined),
    [showAllErrors, touched, validation.errors]
  )

  /* ------------------------ sections & linking ---------------------- */
  const registerSection = React.useCallback((id: SectionId, el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el)
    else sectionRefs.current.delete(id)
  }, [])

  const toggleSection = React.useCallback((id: SectionId, value?: boolean) => {
    setOpen((o) => {
      const n = new Set(o)
      if (value ?? !n.has(id)) n.add(id)
      else n.delete(id)
      return n
    })
  }, [])

  /** Open a section (keeping Items), scroll to it and focus a field. */
  const focusSection = React.useCallback((id: SectionId, field?: string) => {
    setOpen(new Set<SectionId>(["items", id]))
    requestAnimationFrame(() =>
      setTimeout(() => {
        const el = sectionRefs.current.get(id)
        if (!el) return
        el.scrollIntoView({ behavior: "smooth", block: "start" })
        const target =
          (field && el.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`)) ||
          el.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea, button[role=combobox], [data-field]")
        target?.focus({ preventScroll: true })
      }, 220)
    )
  }, [])

  const setHighlight = React.useCallback((id: SectionId | null) => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    setHighlightState(id)
    if (id) highlightTimer.current = setTimeout(() => setHighlightState(null), 1200)
  }, [])

  const setView = React.useCallback((v: View) => {
    setViewState(v)
    writeLocal(KEYS.view, v)
  }, [])

  /* ------------------------- clients & catalog ---------------------- */
  const saveClient = React.useCallback((c: Client) => {
    setClients((all) => (all.some((x) => x.id === c.id) ? all.map((x) => (x.id === c.id ? c : x)) : [...all, c]))
    if (!guestRef.current) saveClientRemote(c).catch((e) => console.warn("[editor] client not saved:", (e as Error).message))
  }, [])

  const saveCatalogItem = React.useCallback((item: CatalogItem) => {
    setCatalog((all) => [...all.filter((x) => x.name.toLowerCase() !== item.name.toLowerCase()), item])
    if (!guestRef.current) saveItemRemote(item).catch((e) => console.warn("[editor] item not saved:", (e as Error).message))
  }, [])

  // defaults changed in Settings while the editor is open
  React.useEffect(() => onSettingsChanged((patch) => setDefaults((d) => ({ ...d, ...patch }))), [])

  /**
   * "Save as my default" for business, payment, terms or signature. The
   * checkboxes call this on every change, so writes are batched.
   */
  const pendingDefaults = React.useRef<Partial<WorkspaceSettings>>({})
  const defaultsTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDefaults = React.useCallback((patch: Partial<WorkspaceSettings>) => {
    if (guestRef.current) return
    setDefaults((d) => ({ ...d, ...patch }))
    pendingDefaults.current = { ...pendingDefaults.current, ...patch }
    if (defaultsTimer.current) clearTimeout(defaultsTimer.current)
    defaultsTimer.current = setTimeout(() => {
      const batch = pendingDefaults.current
      pendingDefaults.current = {}
      saveSettingsRemote(batch).catch((e) => console.warn("[editor] defaults not saved:", (e as Error).message))
    }, 700)
  }, [])

  /** Reflect server-owned fields (token, status) without an undo step. */
  const applyServer = React.useCallback((patch: Partial<Invoice>) => {
    setHist((h) => ({ ...h, present: { ...h.present, ...patch } }))
  }, [])

  const markSent = React.useCallback((patch: Partial<Invoice>) => {
    applyServer(patch)
    setServerDirty(false)
    setSave({ status: "saved", savedAt: Date.now() })
    if (isNew.current) {
      isNew.current = false
      window.history.replaceState(null, "", `/invoices/${latest.current.id}`)
    }
    invoicesChanged()
  }, [applyServer])

  return {
    ready,
    invoice,
    totals,
    validation,
    update,
    undo,
    redo,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
    save,
    retrySave,
    takenNumbers,
    clients,
    saveClient,
    catalog,
    saveCatalogItem,
    defaults,
    saveDefaults,
    notFound,
    confirmAccount,
    setConfirmAccount,
    touch,
    errorFor,
    setShowAllErrors,
    open,
    toggleSection,
    focusSection,
    registerSection,
    highlight,
    setHighlight,
    view,
    setView,
    markSent,
    applyServer,
    /** Signed out: everything stays in memory and is gone on reload. */
    guest,
    /** A guest's invoice was just carried into this account. */
    adopted,
    /** Guest work came back from a trip to the login page. */
    restored,
    accountPrompt,
    askAccount,
    closeAccountPrompt,
  }
}

export type EditorApi = ReturnType<typeof useEditor>
