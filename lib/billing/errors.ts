/**
 * Codes the payment functions raise (as the Postgres error message, errcode
 * P0001) and what a person sees for each.
 */
import { formatINR } from "./money.ts"

export const BILLING_CODES = [
  "OVERPAYMENT",
  "INVOICE_NOT_SENT",
  "INVOICE_VOID",
  "FUTURE_DATE",
  "INVALID_AMOUNT",
  "INVALID_INPUT",
  "INVALID_REASON",
  "HAS_PAYMENTS",
  "TOTAL_BELOW_PAID",
  "TOTAL_BELOW_SETTLED",
  "TDS_SECTION_REQUIRED",
  "CREDIT_EXCEEDS_INVOICE",
  "LINE_CREDIT_EXCEEDED",
  "REFUND_EXCEEDS_CREDIT",
  "HAS_REFUNDS",
  "CLIENT_MISMATCH",
  "HAS_CREDIT_NOTES",
  "CLIENT_LOCKED",
  "QUOTE_LOCKED",
  "QUOTE_NOT_SENT",
  "QUOTE_DECLINED",
  "QUOTE_VOID",
  "QUOTE_INCOMPLETE",
  "ALREADY_CONVERTED",
  "CONVERSION_EXCEEDS_REMAINING",
  "ALREADY_RESPONDED",
  "LINK_INACTIVE",
  "INVALID_TARGET",
  "PROFORMA_NO_DECLINE",
  "NAME_REQUIRED",
  "CONFIRM_REQUIRED",
  "NOT_FOUND",
  "FORBIDDEN",
] as const

export type BillingCode = (typeof BILLING_CODES)[number]

export const isBillingCode = (v: unknown): v is BillingCode => typeof v === "string" && (BILLING_CODES as readonly string[]).includes(v)

/** `detail` is the number some codes carry (the balance, the amount already received), in paise. */
export function billingMessage(code: string, detail?: string | null) {
  const amount = detail && /^\d+$/.test(detail) ? formatINR(Number(detail)) : null
  switch (code) {
    case "OVERPAYMENT":
      return amount ? `Received + TDS is more than the balance due (${amount}). Settle ${amount} or less.` : "Received + TDS is more than the balance due."
    case "INVOICE_NOT_SENT":
      return "This invoice is still a draft. Mark it as sent to record payments."
    case "INVOICE_VOID":
      return "This invoice is void. Payments can't be recorded."
    case "FUTURE_DATE":
      return "Payment date can't be in the future."
    case "INVALID_AMOUNT":
      return "Enter an amount greater than ₹0."
    case "INVALID_INPUT":
      return "Some details aren't valid. Check them and try again."
    case "INVALID_REASON":
      return "Add a reason of 3 to 200 characters."
    case "HAS_PAYMENTS":
      return "This invoice has payments. Delete them first or issue a credit note."
    case "TOTAL_BELOW_PAID":
    case "TOTAL_BELOW_SETTLED":
      return amount ? `Total can't be less than the ${amount} already settled (received + TDS).` : "Total can't be less than what's already been settled."
    case "CREDIT_EXCEEDS_INVOICE":
      return amount ? `This invoice can only be credited ${amount} more. Lower the credit note.` : "This credit note is more than what's left to credit on the invoice."
    case "LINE_CREDIT_EXCEEDED":
      return "A line is credited more than what's left on it. Lower that line's quantity or amount."
    case "REFUND_EXCEEDS_CREDIT":
      return amount ? `Only ${amount} of this credit note is left to use.` : "That's more than this credit note has left."
    case "HAS_REFUNDS":
      return "This credit note has refunds. Delete them first, then void it."
    case "CLIENT_MISMATCH":
      return "Credit can only be applied to invoices of the same client."
    case "HAS_CREDIT_NOTES":
      return "This invoice has credit notes, so it can't be voided or turned back into a draft. Void the credit notes first."
    case "TDS_SECTION_REQUIRED":
      return "Pick the TDS section the client deducted under."
    case "CLIENT_LOCKED":
      return "This invoice has payments, so its client can't change."
    case "QUOTE_LOCKED":
      return detail === "accepted"
        ? "This quote was accepted, so it's locked. Use Revise to change it (the client will need to accept again)."
        : detail === "converted"
          ? "This quote has been converted, so it can't change."
          : "This was already sent. Use Revise to make a new revision."
    case "QUOTE_NOT_SENT":
      return "This hasn't been sent yet (or a new revision is being prepared)."
    case "QUOTE_DECLINED":
      return "The client declined this quote, so it can't be converted. Revise it to make a new offer."
    case "QUOTE_VOID":
      return "This quote is void."
    case "QUOTE_INCOMPLETE":
      return detail === "client"
        ? "Choose a client before sending."
        : detail === "items"
          ? "Add at least one item before sending."
          : detail === "validUntil"
            ? "Set a Valid until date on or after the issue date."
            : "Fill in the required details before sending."
    case "ALREADY_CONVERTED":
      return "This has already been converted. Turn on multiple invoices per quote in quote settings to invoice it in parts."
    case "CONVERSION_EXCEEDS_REMAINING":
      return "That's more than what's left to invoice on this quote."
    case "ALREADY_RESPONDED":
      return detail === "declined" ? "This quote was already declined." : "This quote was already answered."
    case "LINK_INACTIVE":
      return "This link isn't active any more. Ask the business for a new one."
    case "INVALID_TARGET":
      return "A proforma can only be converted to an invoice."
    case "PROFORMA_NO_DECLINE":
      return "A proforma invoice can only be accepted."
    case "NAME_REQUIRED":
      return "Enter your name to accept."
    case "CONFIRM_REQUIRED":
      return "This quote was accepted. Confirm that you want to revise it: the client will need to accept again."
    case "NOT_FOUND":
    case "FORBIDDEN":
      return "This item no longer exists or you don't have access."
    default:
      return "Something went wrong. Your payment was not saved. Try again."
  }
}

/** A Postgres/PostgREST error from one of the payment functions, if it is one. */
export function billingCodeOf(error: { code?: string; message?: string } | null | undefined): BillingCode | null {
  if (!error || error.code !== "P0001") return null
  return isBillingCode(error.message) ? error.message : null
}
