import "server-only"

/** The business calendar. PrettyBills is for India, so "today" and "overdue" follow IST. */
export const APP_TIME_ZONE = "Asia/Kolkata"

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })

/** Today's date (yyyy-mm-dd) in the app's time zone. */
export function today(at = new Date()) {
  return ymd.format(at)
}

/** Whole days from `a` to `b` (both yyyy-mm-dd). Positive when b is later. */
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

type PgError = { code?: string; message: string; details?: string | null; hint?: string | null }

/**
 * A Postgres/PostgREST error with a status the API can return.
 * 23505 unique violation → 409, 42501/RLS → 404 (never reveal someone else's row),
 * missing table → 503 with a setup hint.
 */
export class DbError extends Error {
  code?: string
  status: number
  constructor(error: PgError) {
    super(error.message)
    this.name = "DbError"
    this.code = error.code
    this.status = statusFor(error)
  }
}

function statusFor(error: PgError) {
  switch (error.code) {
    case "23505":
      return 409
    case "42501":
      return 404
    case "23514":
    case "22P02":
    case "22023":
      return 422
    case "42P01":
    case "PGRST205":
    case "PGRST202":
      return 503
    default:
      return /row-level security/i.test(error.message) ? 404 : 500
  }
}

/** User-facing message for a failed database call. */
export function dbMessage(error: unknown) {
  if (error instanceof DbError) {
    if (error.status === 409) return "That invoice number is already used. Choose another."
    if (error.status === 404) return "Not found"
    if (error.status === 422) return "Some details aren't valid. Check the invoice and try again."
    if (error.status === 503) return "The database isn't set up yet. Run the Supabase migrations in supabase/migrations."
  }
  return "Something went wrong saving that. Try again."
}

export function dbStatus(error: unknown) {
  return error instanceof DbError ? error.status : 500
}
