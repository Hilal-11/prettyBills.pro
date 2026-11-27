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
const amount = z.number().int().positive().max(9_000_000_000_000_000)

export const paymentInput = z.object({
  invoiceId: z.string().regex(/^[\w-]{1,96}$/),
  amountPaise: amount,
  paidOn: isoDate,
  mode: z.enum(PAYMENT_MODES),
  reference: optionalText(64),
  note: optionalText(500),
  idempotencyKey: z.uuid(),
})

export const paymentUpdate = z.object({
  paymentId: z.uuid(),
  amountPaise: amount,
  paidOn: isoDate,
  mode: z.enum(PAYMENT_MODES),
  reference: optionalText(64),
  note: optionalText(500),
})

export const paymentDelete = z.object({
  paymentId: z.uuid(),
  reason: z.string().trim().min(3, "Say why, in at least 3 characters").max(200),
})

export type PaymentInput = z.infer<typeof paymentInput>
export type PaymentUpdate = z.infer<typeof paymentUpdate>
