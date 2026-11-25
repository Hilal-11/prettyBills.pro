import type { Browser } from "playwright"

import { footerText } from "@/components/landing/invoice-standard"
import { DEFAULT_TEMPLATE_ID, templateMeta } from "@/lib/invoice/templates"
import { computeInvoiceTotals } from "@/lib/invoice/totals"
import type { Invoice } from "@/lib/invoice/types"

import { dropPrintJob, putPrintJob } from "./store"

/**
 * Renders an invoice to PDF with a headless browser, from the same React
 * template the editor previews (the /print/<token> page). Text stays
 * selectable, fonts are embedded and the QR is vector.
 *
 * Browser: Playwright's bundled Chromium when installed (`npx playwright install
 * chromium`), otherwise an installed Edge or Chrome. Override with
 * PDF_BROWSER_CHANNEL=chrome|msedge|chromium. Serverless hosts need a
 * Chromium build such as @sparticuz/chromium instead.
 */

let browserPromise: Promise<Browser> | null = null

async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright")
  const preferred = process.env.PDF_BROWSER_CHANNEL
  const attempts: (string | undefined)[] = preferred ? [preferred] : [undefined, "msedge", "chrome"]
  let last: unknown
  for (const channel of attempts) {
    try {
      return await chromium.launch({ channel: channel === "chromium" ? undefined : channel })
    } catch (error) {
      last = error
    }
  }
  throw new Error(`No browser available for PDF rendering. Run "npx playwright install chromium". (${String(last).split("\n")[0]})`)
}

function getBrowser() {
  browserPromise ??= launch().catch((error) => {
    browserPromise = null
    throw error
  })
  return browserPromise
}

export async function renderInvoicePdf(invoice: Invoice, origin: string): Promise<Uint8Array> {
  const token = await putPrintJob(invoice)
  const browser = await getBrowser()
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 })
  try {
    await page.goto(`${origin}/print/${token}`, { waitUntil: "networkidle", timeout: 30_000 })
    await page.waitForSelector("[data-print-ready]", { timeout: 15_000 })
    await page.evaluate(() => document.fonts.ready)
    const receipt = templateMeta(invoice.templateId).size === "80mm"
    if (receipt) {
      const heightPx = await page.evaluate(() => document.querySelector("[data-print-ready]")?.getBoundingClientRect().height ?? 1123)
      // the print page lays receipts out at 302px (80mm at 96 dpi)
      return await page.pdf({ width: "80mm", height: `${Math.ceil(heightPx) + 2}px`, printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } })
    }
    const folio = (invoice.templateId || DEFAULT_TEMPLATE_ID) === DEFAULT_TEMPLATE_ID
    if (!folio) return await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } })
    // Folio: real "Page X of Y" in a footer drawn by the browser on every page.
    const black = invoice.pageColor === "black"
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
    const footer = `<div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;width:100%;height:16mm;margin:0 0 -4mm;padding:4mm 13mm 0;display:flex;justify-content:space-between;align-items:flex-start;font-family:Geist,Arial,sans-serif;font-size:7.5px;color:${black ? "rgba(255,255,255,.65)" : "#4b5160"};background:${black ? "#0b0b0c" : "#fff"};border-top:1px solid ${black ? "rgba(255,255,255,.15)" : "#e3e5ea"}"><span>${esc(footerText(invoice, computeInvoiceTotals(invoice)))}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`
    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
      margin: { top: "0", right: "0", bottom: "14mm", left: "0" },
    })
  } finally {
    await page.close().catch(() => {})
    await dropPrintJob(token).catch(() => {})
  }
}
