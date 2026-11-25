/** Dates and identifiers. ISO yyyy-mm-dd in storage, DD MMM YYYY on screen. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export type DateFormat = "DD MMM YYYY" | "DD/MM/YYYY"

export function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "")
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

export function toISO(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

/** Local calendar date → ISO, ignoring the time zone (for date pickers). */
export function localDateToISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function isoToLocalDate(iso: string) {
  const d = parseISO(iso)
  return d ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : undefined
}

/** "01 Nov 2026" (default) or "01/11/2026". Never the US MM/DD order. */
export function formatDate(iso: string, format: DateFormat = "DD MMM YYYY") {
  const d = parseISO(iso)
  if (!d) return ""
  const dd = String(d.getUTCDate()).padStart(2, "0")
  if (format === "DD/MM/YYYY") return `${dd}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`
  return `${dd} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function addDays(iso: string, days: number) {
  const d = parseISO(iso)
  if (!d) return iso
  d.setUTCDate(d.getUTCDate() + days)
  return toISO(d)
}

export function daysBetween(fromISO: string, toISOStr: string) {
  const a = parseISO(fromISO)
  const b = parseISO(toISOStr)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** Indian financial year (Apr–Mar) as "26-27". */
export function financialYear(iso: string) {
  const d = parseISO(iso) ?? new Date()
  const y = d.getUTCFullYear() % 100
  const start = d.getUTCMonth() >= 3 ? y : y - 1
  return `${String(start).padStart(2, "0")}-${String(start + 1).padStart(2, "0")}`
}

/** INV/26-27/015 */
export function invoiceNumber(prefix: string, iso: string, counter: number) {
  return `${prefix}/${financialYear(iso)}/${String(counter).padStart(3, "0")}`
}

/** The next number in this financial year's INV series: highest used + 1 (001 for the first). */
export function nextInvoiceNumber(used: string[], iso: string, prefix = "INV") {
  const series = invoiceNumber(prefix, iso, 0).replace(/000$/, "")
  const counters = used.map((n) => (n.startsWith(series) ? Number(n.slice(series.length)) : 0)).filter((n) => Number.isFinite(n) && n > 0)
  return invoiceNumber(prefix, iso, counters.length ? Math.max(...counters) + 1 : 1)
}

/** INV/26-27/015 + "Monsoon Media" → INV-26-27-015_monsoon-media.pdf */
export function pdfFilename(number: string, clientName: string) {
  const slug = clientName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 40)
  return `${number.replace(/[\\/]+/g, "-").replace(/[^\w.-]/g, "") || "invoice"}${slug ? `_${slug}` : ""}.pdf`
}

/** Plain number for inputs: strips leading zeros ("01" → "1"), keeps up to `decimals`. */
export function normaliseNumberInput(raw: string, decimals: number) {
  let s = raw.replace(/[^\d.]/g, "")
  const dot = s.indexOf(".")
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, decimals)
  if (decimals === 0) s = s.replace(".", "")
  s = s.replace(/^0+(?=\d)/, "")
  return s
}

export function relativeTime(fromMs: number, nowMs: number) {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000))
  if (s < 10) return "just now"
  if (s < 60) return `${s} seconds ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`
  const h = Math.round(m / 60)
  return `${h} hour${h === 1 ? "" : "s"} ago`
}

export function randomToken(bytes = 18) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, Math.max(24, bytes * 2))
}

export function uid(prefix = "id") {
  return `${prefix}_${randomToken(8)}`
}
