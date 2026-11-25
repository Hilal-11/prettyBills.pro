"use client"

import { formatDate, pdfFilename } from "@/lib/invoice/format"
import { formatMoney, type Totals } from "@/lib/invoice/totals"
import type { Invoice } from "@/lib/invoice/types"

async function errorOf(res: Response) {
  const data = await res.json().catch(() => null)
  return (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`
}

export async function fetchPdf(invoice: Invoice, opts: { colorless?: boolean } = {}) {
  const res = await fetch(`/api/invoices/${invoice.id}/pdf`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice, colorless: opts.colorless }),
  })
  if (!res.ok) throw new Error(await errorOf(res))
  return res.blob()
}

export async function downloadPdf(invoice: Invoice, opts: { colorless?: boolean } = {}) {
  const blob = await fetchPdf(invoice, opts)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = pdfFilename(invoice.number, invoice.billTo.name)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Prints the generated PDF through a hidden iframe (falls back to a new tab). */
export async function printPdf(invoice: Invoice) {
  const blob = await fetchPdf(invoice)
  const url = URL.createObjectURL(blob)
  const frame = document.createElement("iframe")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
  frame.src = url
  document.body.appendChild(frame)
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      window.open(url, "_blank", "noopener")
    }
    setTimeout(() => {
      frame.remove()
      URL.revokeObjectURL(url)
    }, 60_000)
  }
}

export async function shareLink(invoice: Invoice, active?: boolean) {
  const res = await fetch(`/api/invoices/${invoice.id}/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice, active }),
  })
  if (!res.ok) throw new Error(await errorOf(res))
  return (await res.json()) as { token: string; url: string; active: boolean }
}

export function whatsappUrl(invoice: Invoice, totals: Totals, link: string) {
  const digits = (invoice.billTo.phone ?? "").replace(/\D/g, "")
  const phone = digits.length === 10 ? `91${digits}` : digits
  const text = `Hi ${invoice.billTo.name}, here's invoice ${invoice.number} for ${formatMoney(totals.balanceDue, { whole: true })}, due ${formatDate(invoice.dueDate, invoice.dateFormat)}: ${link}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

export type SendPayload = {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  message: string
  attachPdf: boolean
  includeLink: boolean
  copyMe: boolean
}

export async function sendInvoice(invoice: Invoice, payload: SendPayload) {
  const res = await fetch(`/api/invoices/${invoice.id}/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice, ...payload }),
  })
  if (!res.ok) throw new Error(await errorOf(res))
  return (await res.json()) as { ok: true; delivered: boolean; sentAt: string; status: Invoice["status"]; publicToken?: string; summary: string }
}
