/** Input shapes for payments, shared by the dialog and the server actions. */
import { z } from "zod"

import { isISODate } from "./dates.ts"
import { PAYMENT_MODES } from "./modes.ts"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined)

const isoDate = z.string().refine(isISODate, "Enter a valid date")
/** Received may be 0 when the client's TDS settles the whole amount. */
const received = z.number().int().min(0).max(9_000_000_000_000_000)

/** TDS the client deducted: an amount and, when it's above 0, a section. */
const tds = {
  tdsPaise: z.number().int().min(0).max(9_000_000_000_000_000).default(0),
  tdsSection: optionalText(40),
  tdsRateBp: z.number().int().min(0).max(10_000).optional(),
}
const settlesSomething = (v: { amountPaise: number; tdsPaise: number }) => v.amountPaise + v.tdsPaise > 0
const tdsHasSection = (v: { tdsPaise: number; tdsSection?: string }) => v.tdsPaise === 0 || !!v.tdsSection

export const paymentInput = z
  .object({
    invoiceId: z.string().regex(/^[\w-]{1,96}$/),
    amountPaise: received,
    ...tds,
    paidOn: isoDate,
    mode: z.enum(PAYMENT_MODES),
    reference: optionalText(64),
    note: optionalText(500),
    idempotencyKey: z.uuid(),
  })
  .refine(settlesSomething, { message: "Enter an amount greater than ₹0", path: ["amountPaise"] })
  .refine(tdsHasSection, { message: "Pick the TDS section", path: ["tdsSection"] })

export const paymentUpdate = z
  .object({
    paymentId: z.uuid(),
    amountPaise: received,
    ...tds,
    paidOn: isoDate,
    mode: z.enum(PAYMENT_MODES),
    reference: optionalText(64),
    note: optionalText(500),
  })
  .refine(settlesSomething, { message: "Enter an amount greater than ₹0", path: ["amountPaise"] })
  .refine(tdsHasSection, { message: "Pick the TDS section", path: ["tdsSection"] })

export const paymentDelete = z.object({
  paymentId: z.uuid(),
  reason: z.string().trim().min(3, "Say why, in at least 3 characters").max(200),
})

export type PaymentInput = z.infer<typeof paymentInput>
export type PaymentUpdate = z.infer<typeof paymentUpdate>
