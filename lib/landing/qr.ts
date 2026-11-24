import { create } from "qrcode"

/**
 * Builds a QR code as a single SVG path (one 1x1 square per dark module).
 * Synchronous and pure, so it is safe to run during prerender.
 */
export function qrPath(text: string) {
  const { modules } = create(text, { errorCorrectionLevel: "M" })
  const { size } = modules
  let d = ""
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules.get(row, col)) d += `M${col} ${row}h1v1h-1z`
    }
  }
  return { d, size }
}
