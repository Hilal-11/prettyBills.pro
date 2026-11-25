/** localStorage helpers that never throw (private mode, quota, SSR). */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export const KEYS = {
  currentInvoice: "pb.currentInvoiceId",
  counter: "pb.invoiceCounter",
  clients: "pb.clients",
  catalog: "pb.catalog",
  business: "pb.businessProfile",
  payment: "pb.defaultPayment",
  terms: "pb.defaultTerms",
  signature: "pb.signature",
  view: "pb.editor.view",
  split: "pb.editor.split",
  owner: "pb.ownerId",
} as const
