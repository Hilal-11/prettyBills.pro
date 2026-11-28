/**
 * Cache tags and what each kind of change invalidates. One place, used by
 * the server (updateTag / revalidateTag) and the browser (query keys).
 *
 * Every tag and key is scoped to the user (one user = one business here), so
 * nothing cached for one account can be served to another.
 */

export type ChangeEvent = "invoice" | "payment" | "credit_note" | "client" | "item" | "quote" | "settings"

export const tag = {
  dashboard: (u: string) => `dashboard:${u}`,
  invoices: (u: string) => `invoices:${u}`,
  invoice: (id: string) => `invoice:${id}`,
  payments: (u: string) => `payments:${u}`,
  receipts: (u: string) => `receipts:${u}`,
  creditNotes: (u: string) => `credit-notes:${u}`,
  clients: (u: string) => `clients:${u}`,
  client: (id: string) => `client:${id}`,
  items: (u: string) => `items:${u}`,
  quotes: (u: string) => `quotes:${u}`,
  business: (u: string) => `business:${u}`,
}

export type ChangeIds = { invoiceId?: string | null; clientId?: string | null; quoteId?: string | null }

/** The server tags a change makes stale (the invalidation map). */
export function tagsFor(event: ChangeEvent, u: string, ids: ChangeIds = {}): string[] {
  const money = [tag.dashboard(u), tag.invoices(u), tag.clients(u), ...(ids.invoiceId ? [tag.invoice(ids.invoiceId)] : []), ...(ids.clientId ? [tag.client(ids.clientId)] : [])]
  switch (event) {
    case "invoice":
      return money
    case "payment":
      return [...money, tag.payments(u), tag.receipts(u)]
    case "credit_note":
      return [...money, tag.creditNotes(u), tag.payments(u)]
    case "client":
      return [tag.clients(u), tag.dashboard(u), ...(ids.clientId ? [tag.client(ids.clientId)] : [])]
    case "item":
      return [tag.items(u)]
    case "quote":
      // a conversion makes an invoice, an acceptance moves the dashboard line
      return [tag.quotes(u), tag.dashboard(u), tag.invoices(u), ...(ids.clientId ? [tag.client(ids.clientId)] : [])]
    case "settings":
      return [tag.business(u)]
  }
}
