/**
 * Customisable dashboards: a few named boards, each an ordered list of cards
 * picked from the widget catalog, each card small, medium or large. Saved
 * in a cookie (compact JSON) so the server renders your layout straight
 * away, with no flash of the default one. Pure: no React, no I/O.
 */

export const WIDGET_TYPES = ["cashflow", "ageing", "status", "methods", "topClients", "forecast", "daysToPay", "overdue", "upcoming", "recent", "activity", "shortcuts"] as const
export type WidgetType = (typeof WIDGET_TYPES)[number]

export const SIZES = ["s", "m", "l"] as const
export type Size = (typeof SIZES)[number]
export const SIZE_LABEL: Record<Size, string> = { s: "Small", m: "Medium", l: "Full width" }

export type WidgetMeta = { title: string; description: string; group: "Charts" | "Lists" | "Other"; size: Size }

export const WIDGETS: Record<WidgetType, WidgetMeta> = {
  cashflow: { title: "Collected vs invoiced", description: "Month by month: what you billed and what came in.", group: "Charts", size: "m" },
  ageing: { title: "Receivables by age", description: "What's owed, split by how late it is.", group: "Charts", size: "m" },
  status: { title: "Invoices by status", description: "Drafts, sent, overdue, paid and void at a glance.", group: "Charts", size: "s" },
  methods: { title: "How clients pay", description: "UPI, bank transfer, cash and more, over 12 months.", group: "Charts", size: "s" },
  topClients: { title: "Top clients", description: "Who you bill most, and what each still owes.", group: "Charts", size: "s" },
  forecast: { title: "Cash coming in", description: "Open balances falling due, week by week.", group: "Charts", size: "s" },
  daysToPay: { title: "Days to get paid", description: "Average days from invoice to paid in full.", group: "Charts", size: "s" },
  overdue: { title: "Overdue invoices", description: "Who to chase, latest first, with a WhatsApp reminder.", group: "Lists", size: "s" },
  upcoming: { title: "Due soon", description: "Open invoices falling due in the next two weeks.", group: "Lists", size: "s" },
  recent: { title: "Recent invoices", description: "The invoices you made or changed last.", group: "Lists", size: "s" },
  activity: { title: "Recent activity", description: "Opens, downloads, payments and reminders.", group: "Lists", size: "s" },
  shortcuts: { title: "Shortcuts", description: "New invoice, add a client, record a payment.", group: "Other", size: "s" },
}

export type Card = { id: string; type: WidgetType; size: Size }
export type Board = { id: string; name: string; cards: Card[] }
export type Boards = { active: string; boards: Board[] }

export const MAX_BOARDS = 8
export const MAX_CARDS = 24

type Preset = { name: string; description: string; cards: [WidgetType, Size][] }

/** Dashboard templates: a starting set of cards someone can then change. */
export const PRESETS = {
  overview: {
    name: "Overview",
    description: "Money in and out, what's late, and what happened.",
    cards: [
      ["cashflow", "m"],
      ["status", "s"],
      ["overdue", "s"],
      ["upcoming", "s"],
      ["activity", "s"],
      ["ageing", "m"],
      ["topClients", "s"],
    ],
  },
  collections: {
    name: "Collections",
    description: "Everything about getting paid on time.",
    cards: [
      ["ageing", "l"],
      ["overdue", "s"],
      ["upcoming", "s"],
      ["forecast", "s"],
      ["daysToPay", "s"],
      ["methods", "s"],
      ["shortcuts", "s"],
    ],
  },
  clients: {
    name: "Clients",
    description: "Who you work with most and who owes you.",
    cards: [
      ["topClients", "m"],
      ["status", "s"],
      ["ageing", "m"],
      ["recent", "s"],
      ["activity", "s"],
    ],
  },
  blank: { name: "Blank", description: "Start empty and add the cards you want.", cards: [] },
} satisfies Record<string, Preset>
export type PresetId = keyof typeof PRESETS

let seq = 0
/** Short ids, unique within a layout. */
export function newId(prefix: string) {
  seq = (seq + 1) % 1296
  return `${prefix}${Date.now().toString(36).slice(-5)}${seq.toString(36)}`
}

export function boardFromPreset(preset: PresetId, name?: string): Board {
  const p = PRESETS[preset]
  return { id: newId("b"), name: name ?? p.name, cards: p.cards.map(([type, size], i) => ({ id: `c${i}${newId("")}`, type, size })) }
}

/** What a first visit shows. Fixed ids, so server and browser agree. */
export const DEFAULT_BOARDS: Boards = {
  active: "overview",
  boards: [{ id: "overview", name: "Overview", cards: PRESETS.overview.cards.map(([type, size], i) => ({ id: `d${i}`, type, size })) }],
}

export const COOKIE = "pb_dash"

const ID = /^[\w-]{1,24}$/

/** Cookie → boards. Anything malformed falls back to the default; unknown cards are dropped. */
export function parseBoards(raw: string | undefined | null): Boards {
  if (!raw) return DEFAULT_BOARDS
  try {
    const v = JSON.parse(raw) as { a?: unknown; b?: unknown }
    if (!Array.isArray(v.b)) return DEFAULT_BOARDS
    const boards: Board[] = []
    for (const b of v.b.slice(0, MAX_BOARDS) as { i?: unknown; n?: unknown; c?: unknown }[]) {
      if (typeof b?.i !== "string" || !ID.test(b.i) || typeof b.n !== "string" || !Array.isArray(b.c)) continue
      const cards: Card[] = []
      for (const c of b.c.slice(0, MAX_CARDS) as unknown[][]) {
        const [type, size, id] = Array.isArray(c) ? c : []
        if ((WIDGET_TYPES as readonly unknown[]).includes(type) && (SIZES as readonly unknown[]).includes(size) && typeof id === "string" && ID.test(id) && !cards.some((x) => x.id === id))
          cards.push({ type: type as WidgetType, size: size as Size, id })
      }
      if (!boards.some((x) => x.id === b.i)) boards.push({ id: b.i, name: b.n.trim().slice(0, 40) || "Dashboard", cards })
    }
    if (!boards.length) return DEFAULT_BOARDS
    const active = typeof v.a === "string" && boards.some((b) => b.id === v.a) ? v.a : boards[0].id
    return { active, boards }
  } catch {
    return DEFAULT_BOARDS
  }
}

/** Boards → the compact cookie value. */
export function serializeBoards(b: Boards) {
  return JSON.stringify({ a: b.active, b: b.boards.map((x) => ({ i: x.id, n: x.name, c: x.cards.map((c) => [c.type, c.size, c.id]) })) })
}
