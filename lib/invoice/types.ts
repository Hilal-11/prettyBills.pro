/**
 * PrettyBills invoice data model. All money is stored as integer paise.
 * Kept free of runtime imports so it can be shared by server, client and tests.
 */

export type Paise = number

export interface Address {
  line1: string
  line2?: string
  city: string
  pin?: string
  /** GST state code, e.g. "27" for Maharashtra. */
  stateCode: string
  country: string
}

export interface PartySnapshot {
  name: string
  legalName?: string
  gstin?: string
  pan?: string
  address: Address
  email?: string
  phone?: string
  website?: string
}

export interface BusinessSnapshot extends PartySnapshot {
  logo?: {
    url: string // data URL until uploads go to storage
    size: "s" | "m" | "l"
    position: "left" | "right"
    lightTile: boolean // on a black page, show the logo on a white tile
  }
}

export interface BankDetails {
  holder: string
  accountNumber: string
  ifsc: string
  bankName?: string
  branch?: string
  accountType: "savings" | "current"
}

export type InvoiceStatus = "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "overdue" | "void"
export type PaymentTerms = "due_on_receipt" | "net_7" | "net_15" | "net_30" | "net_45" | "net_60" | "custom"
export type SupplyType = "b2b" | "b2c" | "export"
export type Discount = { kind: "percent" | "amount"; value: number } // amount kind: paise

export interface LineItem {
  id: string
  catalogItemId?: string
  name: string
  description?: string
  hsnSac?: string
  qty: number // up to 3 decimals
  unit: string
  rate: Paise
  discount?: Discount
  taxRate: number
  taxCategory?: "taxable" | "exempt" | "nil"
}

export interface Charge {
  id: string
  label: string
  amount: Paise
  taxRate: number
}

export interface Signature {
  show: boolean
  kind: "draw" | "type" | "upload"
  imageUrl?: string // transparent PNG data URL (draw / upload)
  typedName?: string
  font?: string
  signatoryName?: string
  designation?: string
  label: string
  stampUrl?: string
}

/** Pre-sale documents share the invoice document exactly; this says which kind. */
export type QuoteKind = "quote" | "proforma"
export type QuoteTitle = "Quotation" | "Estimate" | "Proforma Invoice"

export interface QuoteMeta {
  kind: QuoteKind
  title: QuoteTitle
  /** Required to send a quote; optional on a proforma. */
  validUntil?: string | null
}

export interface Invoice {
  id: string
  businessId: string
  number: string
  title: "Tax Invoice" | "Invoice" | "Bill of Supply"
  status: InvoiceStatus
  templateId: string
  pageColor: "white" | "black"
  issueDate: string // ISO yyyy-mm-dd
  dueDate: string
  paymentTerms: PaymentTerms
  poNumber?: string
  reference?: string
  currency: string
  exchangeRate?: number
  lut?: string
  reverseCharge: boolean
  from: BusinessSnapshot
  clientId: string
  billTo: PartySnapshot
  shipTo?: Address & { name: string }
  placeOfSupply: string // state code; "96" = other country (export)
  supplyType: SupplyType
  items: LineItem[]
  invoiceDiscount?: Discount
  charges: Charge[]
  tcs?: { rate: number }
  roundOff: boolean
  showAmountInWords: boolean
  payment: {
    showUpiQr: boolean
    upiId?: string
    showBank: boolean
    bank?: BankDetails
    paymentLink: boolean
    instructions?: string
    amountPaid: Paise
  }
  notes?: string
  terms?: string
  footer?: string
  signature?: Signature
  customFields: { id: string; label: string; value: string }[]
  attachments: { id: string; name: string; url: string; size: number }[]
  columns: { hsn: boolean; unit: boolean; discount: boolean; tax: boolean }
  dateFormat: "DD MMM YYYY" | "DD/MM/YYYY"
  language: "en"
  internalNote?: string
  publicToken?: string
  linkActive: boolean
  sentAt?: string
  revision: number
  /** Set on quotes and proforma invoices (stored in the quotes table). */
  quote?: QuoteMeta
  /** An invoice or proforma made from a quote or proforma: where it came from. */
  source?: { type: QuoteKind; id: string; number: string }
  createdAt: string
  updatedAt: string
}
