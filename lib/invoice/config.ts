/**
 * GST and invoicing configuration. UI components read from here; nothing
 * tax-related is hard-coded in the editor.
 */

/** GST state codes (first two digits of a GSTIN). */
export const STATES = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
  { code: "96", name: "Other Country (export)" },
] as const

export function stateName(code: string | undefined) {
  return STATES.find((s) => s.code === code)?.name ?? ""
}

export function stateLabel(code: string | undefined) {
  const name = stateName(code)
  return name ? `${name} (${code})` : ""
}

/**
 * Tax rate options for line items and charges.
 * PLACEHOLDER: rates follow the GST rate rationalisation effective 22 Sep 2025
 * (0 / 5 / 18 / 40). Re-check against the latest CBIC notifications before launch.
 */
export const TAX_RATES: { value: string; label: string; rate: number; category: "taxable" | "exempt" | "nil" }[] = [
  { value: "0", label: "0%", rate: 0, category: "taxable" },
  { value: "5", label: "5%", rate: 5, category: "taxable" },
  { value: "18", label: "18%", rate: 18, category: "taxable" },
  { value: "40", label: "40%", rate: 40, category: "taxable" },
  { value: "exempt", label: "Exempt", rate: 0, category: "exempt" },
  { value: "nil", label: "Nil-rated", rate: 0, category: "nil" },
]

export const DEFAULT_TAX_RATE = 18

export const UNITS = ["pcs", "hrs", "days", "kg", "g", "ltr", "m", "sq ft", "box", "set", "job", "month"] as const

export const PAYMENT_TERMS = [
  { value: "due_on_receipt", label: "Due on receipt", days: 0 },
  { value: "net_7", label: "Net 7", days: 7 },
  { value: "net_15", label: "Net 15", days: 15 },
  { value: "net_30", label: "Net 30", days: 30 },
  { value: "net_45", label: "Net 45", days: 45 },
  { value: "net_60", label: "Net 60", days: 60 },
  { value: "custom", label: "Custom", days: null },
] as const

export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "AED ", name: "UAE Dirham" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
] as const

export function currencySymbol(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? `${code} `
}

export const INVOICE_TITLES = ["Tax Invoice", "Invoice", "Bill of Supply"] as const

/** First four letters of an IFSC → bank name (branch needs a lookup service). */
export const IFSC_BANKS: Record<string, string> = {
  SBIN: "State Bank of India",
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  IDIB: "Indian Bank",
  IOBA: "Indian Overseas Bank",
  BKID: "Bank of India",
  MAHB: "Bank of Maharashtra",
  YESB: "Yes Bank",
  IDFB: "IDFC First Bank",
  INDB: "IndusInd Bank",
  FDRL: "Federal Bank",
  JAKA: "Jammu & Kashmir Bank",
  CIUB: "City Union Bank",
  KARB: "Karnataka Bank",
  SIBL: "South Indian Bank",
  AUBL: "AU Small Finance Bank",
  RATN: "RBL Bank",
  PYTM: "Paytm Payments Bank",
  AIRP: "Airtel Payments Bank",
}

export const SIGNATURE_FONTS = [
  { id: "dancing", label: "Flowing", cssVar: "var(--font-sig-dancing)" },
  { id: "vibes", label: "Formal", cssVar: "var(--font-sig-vibes)" },
  { id: "caveat", label: "Casual", cssVar: "var(--font-sig-caveat)" },
  { id: "allura", label: "Classic", cssVar: "var(--font-sig-allura)" },
] as const

export const LIMITS = {
  logoBytes: 2 * 1024 * 1024,
  signatureBytes: 1 * 1024 * 1024,
  attachmentsBytes: 10 * 1024 * 1024,
  notesChars: 500,
  customFields: 6,
  historySteps: 100,
}
