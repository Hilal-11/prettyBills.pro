/** How money arrived. Same values as the payment_mode enum in Postgres. */

export const PAYMENT_MODES = ["upi", "cash", "bank_transfer", "cheque", "card", "other"] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export const MODE_LABEL: Record<PaymentMode, string> = {
  upi: "UPI",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
}

/** Short label for tight spots (summary strip, chips). */
export const MODE_SHORT: Record<PaymentMode, string> = { ...MODE_LABEL, bank_transfer: "Bank" }

export const isMode = (v: unknown): v is PaymentMode => typeof v === "string" && (PAYMENT_MODES as readonly string[]).includes(v)

/** What the reference field is called for each mode. Cash has none. */
export function referenceLabel(mode: PaymentMode) {
  switch (mode) {
    case "upi":
      return "UTR / UPI ref no."
    case "bank_transfer":
      return "UTR / reference no."
    case "cheque":
      return "Cheque no."
    case "card":
    case "other":
      return "Transaction ID"
    case "cash":
      return null
  }
}

/** Bank-issued references are conventionally upper case. */
export const upperReference = (mode: PaymentMode) => mode === "bank_transfer" || mode === "cheque" || mode === "upi"

/**
 * A gentle note when a reference doesn't look like what the mode usually
 * produces. Never blocks saving: banks vary.
 * UPI UTR: 12 digits. NEFT/RTGS/IMPS UTR: 16–22 letters and digits. Cheque: 6 digits.
 */
export function referenceHint(mode: PaymentMode, reference: string | undefined): string | null {
  const ref = (reference ?? "").trim()
  if (!ref) return mode === "bank_transfer" || mode === "cheque" ? "Recommended, so the payment can be traced later." : null
  if (mode === "upi" && !/^\d{12}$/.test(ref)) return "UPI references are usually 12 digits."
  if (mode === "bank_transfer" && !/^[A-Za-z0-9]{12,22}$/.test(ref)) return "Bank UTRs are usually 12–22 letters and digits."
  if (mode === "cheque" && !/^\d{6}$/.test(ref)) return "Cheque numbers are usually 6 digits."
  return null
}
