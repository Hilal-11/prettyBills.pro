import { EMPTY_SETTINGS, type Workspace, type WorkspaceSettings } from "@/lib/data/types"
import { SEED_CATALOG, SEED_CLIENTS, type CatalogItem, type Client } from "@/lib/invoice/defaults"

import { KEYS, readLocal } from "./local"

/**
 * Browser side of the user's saved data. Everything goes to the server
 * (Postgres); this module only fetches, writes and tells the rest of the page.
 */

const CHANGED = "pb:invoices-changed"

/** Something about the user's invoices changed: the sidebar counts and lists refresh. */
export function invoicesChanged() {
  window.dispatchEvent(new Event(CHANGED))
}

export function onInvoicesChanged(cb: () => void) {
  window.addEventListener(CHANGED, cb)
  return () => window.removeEventListener(CHANGED, cb)
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null)
  if (!res) throw new Error("You seem to be offline. Try again in a moment.")
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Error ${res.status}`)
  return res
}

/** Defaults, clients, items and used numbers. null when signed out or unreachable. */
export async function fetchWorkspace(): Promise<Workspace | null> {
  const res = await fetch("/api/workspace").catch(() => null)
  if (!res?.ok) return null
  return (await res.json()) as Workspace
}

export const saveClientRemote = (client: Client) => send("/api/clients", "POST", { client })
export const deleteClientRemote = (id: string) => send(`/api/clients/${encodeURIComponent(id)}`, "DELETE")
export const saveItemRemote = (item: CatalogItem) => send("/api/items", "POST", { item })
export const deleteItemRemote = (id: string) => send(`/api/items/${encodeURIComponent(id)}`, "DELETE")
export const saveSettingsRemote = (patch: Partial<WorkspaceSettings>) => send("/api/workspace/settings", "PUT", patch)

export async function fetchSettings(): Promise<WorkspaceSettings | null> {
  const res = await fetch("/api/workspace/settings").catch(() => null)
  if (!res?.ok) return null
  return ((await res.json()) as { settings: WorkspaceSettings }).settings
}

const SETTINGS_CHANGED = "pb:settings-changed"

/** Saves defaults from Settings and tells an open editor, so a new invoice picks them up. */
export async function updateSettings(patch: Partial<WorkspaceSettings>) {
  await saveSettingsRemote(patch)
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED, { detail: patch }))
}

export function onSettingsChanged(cb: (patch: Partial<WorkspaceSettings>) => void) {
  const handler = (e: Event) => cb((e as CustomEvent<Partial<WorkspaceSettings>>).detail)
  window.addEventListener(SETTINGS_CHANGED, handler)
  return () => window.removeEventListener(SETTINGS_CHANGED, handler)
}

/**
 * Before accounts had a database, saved details lived in this browser. The
 * first time a signed-in user's account is empty, bring them across, then
 * forget the local copies. Sample data is never imported.
 */
export async function importLocalData(ws: Workspace): Promise<Workspace> {
  const seedClients = new Set(SEED_CLIENTS.map((c) => c.id))
  const seedItems = new Set(SEED_CATALOG.map((c) => c.id))
  const local = {
    business: readLocal<WorkspaceSettings["business"]>(KEYS.business, null),
    payment: readLocal<WorkspaceSettings["payment"]>(KEYS.payment, null),
    terms: readLocal<string | null>(KEYS.terms, null),
    signature: readLocal<WorkspaceSettings["signature"]>(KEYS.signature, null),
    clients: readLocal<Client[]>(KEYS.clients, []).filter((c) => !seedClients.has(c.id) && c.name?.trim()),
    items: readLocal<CatalogItem[]>(KEYS.catalog, []).filter((i) => !seedItems.has(i.id) && i.name?.trim()),
  }
  const patch: Partial<WorkspaceSettings> = {}
  for (const k of ["business", "payment", "terms", "signature"] as const) {
    if (local[k] && !ws.settings[k]) (patch as Record<string, unknown>)[k] = local[k]
  }
  const clients = ws.clients.length ? [] : local.clients
  const items = ws.items.length ? [] : local.items
  if (!Object.keys(patch).length && !clients.length && !items.length) return ws

  try {
    if (Object.keys(patch).length) await saveSettingsRemote(patch)
    await Promise.all([...clients.map(saveClientRemote), ...items.map(saveItemRemote)])
    for (const key of [KEYS.business, KEYS.payment, KEYS.terms, KEYS.signature, KEYS.clients, KEYS.catalog]) {
      try {
        localStorage.removeItem(key)
      } catch {}
    }
    return { ...ws, settings: { ...EMPTY_SETTINGS, ...ws.settings, ...patch }, clients: [...ws.clients, ...clients], items: [...ws.items, ...items] }
  } catch {
    return ws // try again next time
  }
}
