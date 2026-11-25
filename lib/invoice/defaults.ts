import { DEFAULT_TEMPLATE_ID } from "./templates"
import { addDays, invoiceNumber } from "./format"
import type { BusinessSnapshot, Invoice, LineItem, PartySnapshot } from "./types"

/**
 * Seed data for the editor until accounts and a database exist.
 * Everything here is fictional; emails use the reserved .example domain and
 * GSTINs only match the format (they are not registered numbers).
 */

export const SEED_BUSINESS: BusinessSnapshot & { id: string } = {
  id: "rds",
  name: "Rahul Design Studio",
  legalName: "",
  gstin: "01ABCDE1234F1Z5",
  pan: "ABCDE1234F",
  address: { line1: "12 Residency Road, Lal Chowk", line2: "", city: "Srinagar", pin: "190001", stateCode: "01", country: "India" },
  email: "billing@rahuldesign.example",
  phone: "",
  website: "",
}

export type Client = PartySnapshot & { id: string }

export const SEED_CLIENTS: Client[] = [
  {
    id: "monsoon",
    name: "Monsoon Media",
    gstin: "27AABCM4321P1Z7",
    address: { line1: "4th Floor, Kamala Mills", city: "Mumbai", pin: "400013", stateCode: "27", country: "India" },
    email: "finance@monsoonmedia.example",
  },
  {
    id: "lakeview",
    name: "Lakeview Café",
    gstin: "29AAGCL1234M1Z2",
    address: { line1: "80 Feet Road, Indiranagar", city: "Bengaluru", pin: "560038", stateCode: "29", country: "India" },
    email: "accounts@lakeviewcafe.example",
  },
  {
    id: "chinar",
    name: "Chinar Crafts",
    gstin: "01AAFCC5678N1Z9",
    address: { line1: "Polo View Market", city: "Srinagar", pin: "190001", stateCode: "01", country: "India" },
    email: "hello@chinarcrafts.example",
  },
  {
    id: "saffron",
    name: "Saffron Stays",
    gstin: "08AAKCS8765Q1Z3",
    address: { line1: "C-Scheme, Ashok Marg", city: "Jaipur", pin: "302001", stateCode: "08", country: "India" },
    email: "billing@saffronstays.example",
  },
]

export type CatalogItem = Omit<LineItem, "id" | "qty" | "discount"> & { id: string }

export const SEED_CATALOG: CatalogItem[] = [
  { id: "cat-logo", name: "Logo design", hsnSac: "998391", unit: "job", rate: 15000_00, taxRate: 18 },
  { id: "cat-menu", name: "Menu card design", hsnSac: "998391", unit: "pcs", rate: 4000_00, taxRate: 18 },
  { id: "cat-brand", name: "Brand guidelines", hsnSac: "998391", unit: "job", rate: 6000_00, taxRate: 18 },
  { id: "cat-web", name: "Website page design", hsnSac: "998314", unit: "pcs", rate: 8000_00, taxRate: 18 },
  { id: "cat-photo", name: "Product photography", hsnSac: "998383", unit: "hrs", rate: 2500_00, taxRate: 18 },
  { id: "cat-premium", name: "Premium plan", hsnSac: "998391", unit: "month", rate: 999_00, taxRate: 18 },
]

export const SAVED_TERMS = [
  { id: "std", label: "Standard terms", text: "1. Payment due by the due date.\n2. Late payments may attract interest at 1.5% per month.\n3. Goods once sold are not returnable." },
  { id: "creative", label: "Creative work", text: "1. Final files are released after full payment.\n2. Two rounds of revisions are included.\n3. Usage rights transfer on payment." },
]

export function partyFromClient(c: Client): PartySnapshot {
  const { id: _id, ...rest } = c
  void _id
  return structuredClone(rest)
}

export const EMPTY_BUSINESS: BusinessSnapshot & { id: string } = {
  id: "default",
  name: "",
  legalName: "",
  gstin: "",
  pan: "",
  address: { line1: "", line2: "", city: "", pin: "", stateCode: "", country: "India" },
  email: "",
  phone: "",
  website: "",
}

/**
 * A blank invoice for a signed-in user: their business (if saved), no sample
 * client or items. Defaults from settings are applied by the caller.
 */
export function createBlankInvoice(opts: { id: string; today: string; counter: number; business?: BusinessSnapshot & { id?: string } }): Invoice {
  const base = createInvoice({ id: opts.id, today: opts.today, counter: opts.counter, business: { ...EMPTY_BUSINESS, ...opts.business, id: opts.business?.id ?? "default" } })
  return {
    ...base,
    clientId: "",
    billTo: { name: "", address: { line1: "", line2: "", city: "", pin: "", stateCode: "", country: "India" } },
    placeOfSupply: base.from.address.stateCode,
    items: [{ id: "li-1", name: "", hsnSac: "", qty: 1, unit: "pcs", rate: 0, taxRate: 18 }],
    payment: { showUpiQr: false, upiId: "", showBank: false, paymentLink: false, instructions: "", amountPaid: 0 },
    notes: "",
    signature: { show: false, kind: "type", typedName: "", font: "dancing", signatoryName: "", designation: "", label: "Authorised Signatory" },
  }
}

/** A new invoice for a business. `today` is passed in so this stays pure. */
export function createInvoice(opts: { id: string; today: string; counter: number; business?: BusinessSnapshot & { id: string } }): Invoice {
  const business = opts.business ?? SEED_BUSINESS
  const client = SEED_CLIENTS[0]
  const { id: businessId, ...from } = business
  return {
    id: opts.id,
    businessId,
    number: invoiceNumber("INV", opts.today, opts.counter),
    title: from.gstin ? "Tax Invoice" : "Bill of Supply",
    status: "draft",
    templateId: DEFAULT_TEMPLATE_ID,
    pageColor: "white",
    issueDate: opts.today,
    dueDate: addDays(opts.today, 15),
    paymentTerms: "net_15",
    currency: "INR",
    reverseCharge: false,
    from: structuredClone(from),
    clientId: client.id,
    billTo: partyFromClient(client),
    placeOfSupply: client.address.stateCode,
    supplyType: "b2b",
    items: [
      { id: "li-1", catalogItemId: "cat-menu", name: "Menu card design", hsnSac: "998391", qty: 1, unit: "pcs", rate: 4000_00, taxRate: 18 },
      { id: "li-2", catalogItemId: "cat-premium", name: "Premium plan", hsnSac: "998391", qty: 1, unit: "month", rate: 999_00, taxRate: 18 },
    ],
    charges: [],
    roundOff: true,
    showAmountInWords: true,
    payment: {
      showUpiQr: true,
      upiId: "rahulstudio@example",
      showBank: false,
      paymentLink: false,
      instructions: "Please mention the invoice number in the payment note.",
      amountPaid: 0,
    },
    notes: "Thanks for the quick approvals.",
    terms: "",
    footer: "",
    signature: { show: false, kind: "type", typedName: "", font: "dancing", signatoryName: "Rahul Mir", designation: "Proprietor", label: "Authorised Signatory" },
    customFields: [],
    attachments: [],
    columns: { hsn: true, unit: true, discount: false, tax: true },
    dateFormat: "DD MMM YYYY",
    language: "en",
    linkActive: true,
    revision: 1,
    createdAt: opts.today,
    updatedAt: opts.today,
  }
}
