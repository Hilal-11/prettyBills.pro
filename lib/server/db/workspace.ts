import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { EMPTY_SETTINGS, type ClientWithStats, type ItemRow, type WorkspaceSettings } from "@/lib/data/types"
import type { CatalogItem, Client } from "@/lib/invoice/defaults"

import { bucketOf } from "./invoices"
import { DbError, today } from "./util"

/* ------------------------------- settings ------------------------------ */

export async function getSettings(db: SupabaseClient): Promise<WorkspaceSettings> {
  const { data, error } = await db.from("workspace_settings").select("business, payment, terms, signature").maybeSingle()
  if (error) throw new DbError(error)
  return data ? { ...EMPTY_SETTINGS, ...data } : EMPTY_SETTINGS
}

/** Saves only the keys given; `null` clears one. */
export async function saveSettings(db: SupabaseClient, userId: string, patch: Partial<WorkspaceSettings>) {
  const allowed = (["business", "payment", "terms", "signature"] as const).filter((k) => k in patch)
  if (!allowed.length) return
  const row: Record<string, unknown> = { user_id: userId }
  for (const k of allowed) row[k] = patch[k] ?? null
  const { error } = await db.from("workspace_settings").upsert(row, { onConflict: "user_id" })
  if (error) throw new DbError(error)
}

/* -------------------------------- clients ------------------------------ */

type ClientRow = {
  id: string
  name: string
  legal_name: string | null
  gstin: string | null
  pan: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: Client["address"]
  updated_at: string
}

const EMPTY_ADDRESS: Client["address"] = { line1: "", city: "", stateCode: "", country: "India" }

const CLIENT_COLUMNS = "id, name, legal_name, gstin, pan, email, phone, website, address, updated_at"

const toClient = (r: ClientRow): Client => ({
  id: r.id,
  name: r.name,
  legalName: r.legal_name ?? undefined,
  gstin: r.gstin ?? undefined,
  pan: r.pan ?? undefined,
  email: r.email ?? undefined,
  phone: r.phone ?? undefined,
  website: r.website ?? undefined,
  address: { ...EMPTY_ADDRESS, ...(r.address as Partial<Client["address"]>) },
})

const blank = (v: string | undefined, max: number) => (v?.trim() ? v.trim().slice(0, max) : null)

function clientRow(userId: string, c: Client) {
  const a = c.address ?? EMPTY_ADDRESS
  return {
    user_id: userId,
    id: c.id,
    name: c.name.trim().slice(0, 200),
    legal_name: blank(c.legalName, 200),
    gstin: blank(c.gstin?.toUpperCase(), 15),
    pan: blank(c.pan?.toUpperCase(), 10),
    email: blank(c.email, 254),
    phone: blank(c.phone, 32),
    website: blank(c.website, 200),
    address: { line1: a.line1 ?? "", line2: a.line2 ?? "", city: a.city ?? "", pin: a.pin ?? "", stateCode: a.stateCode ?? "", country: a.country || "India" },
  }
}

export async function listClients(db: SupabaseClient): Promise<Client[]> {
  const { data, error } = await db.from("clients").select(CLIENT_COLUMNS).order("name")
  if (error) throw new DbError(error)
  return (data as ClientRow[]).map(toClient)
}

export async function saveClient(db: SupabaseClient, userId: string, c: Client) {
  if (!c.name?.trim()) throw new DbError({ code: "23514", message: "Client name is required" })
  const { error } = await db.from("clients").upsert(clientRow(userId, c), { onConflict: "user_id,id" })
  if (error) throw new DbError(error)
}

export async function deleteClient(db: SupabaseClient, id: string) {
  const { error } = await db.from("clients").delete().eq("id", id)
  if (error) throw new DbError(error)
}

/** Clients with what they've been billed and what they owe, busiest first. */
export async function listClientsWithStats(db: SupabaseClient): Promise<ClientWithStats[]> {
  const [clients, invoices] = await Promise.all([
    db.from("clients").select(CLIENT_COLUMNS).order("name"),
    db.from("invoices").select("client_id, client_name, status, total, balance_due, due_date, issue_date").neq("status", "draft").neq("status", "void"),
  ])
  if (clients.error) throw new DbError(clients.error)
  if (invoices.error) throw new DbError(invoices.error)

  const on = today()
  const stats = new Map<string, { invoices: number; billed: number; outstanding: number; overdue: number; last: string | null }>()
  for (const i of invoices.data as { client_id: string | null; status: string; total: number; balance_due: number; due_date: string | null; issue_date: string }[]) {
    if (!i.client_id) continue
    const s = stats.get(i.client_id) ?? { invoices: 0, billed: 0, outstanding: 0, overdue: 0, last: null }
    s.invoices++
    s.billed += Number(i.total)
    if (i.status !== "paid") s.outstanding += Number(i.balance_due)
    if (bucketOf(i.status, i.due_date, Number(i.balance_due), on) === "overdue") s.overdue += Number(i.balance_due)
    if (!s.last || i.issue_date > s.last) s.last = i.issue_date
    stats.set(i.client_id, s)
  }

  return (clients.data as ClientRow[]).map((r) => {
    const s = stats.get(r.id)
    return { ...toClient(r), invoices: s?.invoices ?? 0, billed: s?.billed ?? 0, outstanding: s?.outstanding ?? 0, overdue: s?.overdue ?? 0, lastInvoiceDate: s?.last ?? null, updatedAt: r.updated_at }
  })
}

/* --------------------------------- items ------------------------------- */

type ItemDbRow = { id: string; name: string; description: string | null; hsn_sac: string | null; unit: string; rate: number; tax_rate: number | string; tax_category: CatalogItem["taxCategory"]; updated_at: string }

const ITEM_COLUMNS = "id, name, description, hsn_sac, unit, rate, tax_rate, tax_category, updated_at"

const toItem = (r: ItemDbRow): ItemRow => ({
  id: r.id,
  name: r.name,
  description: r.description ?? undefined,
  hsnSac: r.hsn_sac ?? undefined,
  unit: r.unit,
  rate: Number(r.rate),
  taxRate: Number(r.tax_rate),
  taxCategory: r.tax_category ?? "taxable",
  updatedAt: r.updated_at,
})

export async function listItems(db: SupabaseClient): Promise<ItemRow[]> {
  const { data, error } = await db.from("items").select(ITEM_COLUMNS).order("name")
  if (error) throw new DbError(error)
  return (data as ItemDbRow[]).map(toItem)
}

/** Upserts an item. One item per name: an item with the same name (any case) is replaced. */
export async function saveItem(db: SupabaseClient, userId: string, item: CatalogItem) {
  const name = item.name?.trim()
  if (!name) throw new DbError({ code: "23514", message: "Item name is required" })
  const { data: same, error: findError } = await db.from("items").select("id").neq("id", item.id).ilike("name", name.replace(/[%_\\]/g, (c) => `\\${c}`))
  if (findError) throw new DbError(findError)
  if (same.length) {
    const { error } = await db.from("items").delete().in("id", same.map((s) => s.id))
    if (error) throw new DbError(error)
  }
  const row = {
    user_id: userId,
    id: item.id,
    name: name.slice(0, 200),
    description: blank(item.description, 1000),
    hsn_sac: blank(item.hsnSac, 10),
    unit: (item.unit || "pcs").slice(0, 20),
    rate: Math.max(0, Math.round(item.rate || 0)),
    tax_rate: Math.min(100, Math.max(0, item.taxRate || 0)),
    tax_category: item.taxCategory ?? "taxable",
  }
  const { error } = await db.from("items").upsert(row, { onConflict: "user_id,id" })
  if (error) throw new DbError(error)
}

export async function deleteItem(db: SupabaseClient, id: string) {
  const { error } = await db.from("items").delete().eq("id", id)
  if (error) throw new DbError(error)
}
