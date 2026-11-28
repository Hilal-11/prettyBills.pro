/**
 * TDS sections offered when recording a payment. India's Income-tax Act 2025
 * (in force from April 2026) renumbered the TDS provisions, so labels live
 * here, not in the UI: update a label or rate in this one file.
 *
 * `key` is what's stored on the payment (payments.tds_section), so never
 * change an existing key; add a new entry instead. `rateBp` is a helper
 * only (basis points: 1000 = 10%); the user can always type the exact
 * amount the client deducted.
 */
export type TdsSection = { key: string; label: string; legacy?: string; rateBp: number | null }

export const TDS_SECTIONS: readonly TdsSection[] = [
  { key: "professional", label: "Professional services", legacy: "old 194J", rateBp: 1000 },
  { key: "technical", label: "Technical services", legacy: "old 194J", rateBp: 200 },
  { key: "contractor_individual", label: "Contractor – individual/HUF", legacy: "old 194C", rateBp: 100 },
  { key: "contractor_other", label: "Contractor – others", legacy: "old 194C", rateBp: 200 },
  { key: "commission", label: "Commission/brokerage", legacy: "old 194H", rateBp: 200 },
  { key: "rent_property", label: "Rent – land/building", legacy: "old 194-I", rateBp: 1000 },
  { key: "ecommerce", label: "E-commerce", legacy: "old 194-O", rateBp: 10 },
  { key: "other", label: "Other / custom", rateBp: null },
]
