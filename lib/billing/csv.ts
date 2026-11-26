/**
 * CSV that opens cleanly in Excel: RFC 4180 quoting, CRLF line ends, a UTF-8
 * BOM (so ₹ and Hindi or Urdu names show), and protection against formula
 * injection: a cell that starts with = + - @, a tab or a CR gets a leading '.
 */

export const BOM = "﻿"

export function csvCell(value: string | number | null | undefined) {
  if (value == null) return ""
  let s = String(value)
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvRow(cells: (string | number | null | undefined)[]) {
  return `${cells.map(csvCell).join(",")}\r\n`
}

/** Paise as a plain number with two decimals: 1457500 → "14575.00". Numbers aren't quoted or prefixed. */
export function csvAmount(p: number) {
  const sign = p < 0 ? "-" : ""
  const abs = Math.abs(p)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
}
