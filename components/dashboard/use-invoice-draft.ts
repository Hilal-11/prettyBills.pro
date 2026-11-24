"use client"

import * as React from "react"

import { DEFAULT_TEMPLATE } from "@/components/landing/invoice-document"
import { clients, sellerStateCode, states } from "@/lib/dashboard/data"
import { sampleInvoice, type InvoiceItem, type SampleInvoice } from "@/lib/landing/invoice"

/** Editor-side shape: the printable invoice plus editor-only fields. */
export type Draft = {
  template: string
  kind: "invoice" | "receipt"
  receiptNumber: string
  paymentMethod: string
  clientId: string
  posCode: string
  gstRate: number
  issueDate: string // yyyy-mm-dd
  dueDate: string
  number: string
  items: (InvoiceItem & { id: string })[]
  upiId: string
  showQr: boolean
  payNow: boolean
  paid: boolean
  notes: string
}

const initialDraft: Draft = {
  template: DEFAULT_TEMPLATE,
  kind: "invoice",
  receiptNumber: "2611-4827-0153",
  paymentMethod: "UPI · GPay",
  clientId: "lakeview",
  posCode: "29",
  gstRate: 18,
  issueDate: "2026-11-25",
  dueDate: "2026-12-10",
  number: "INV/26-27/015",
  items: sampleInvoice.items.map((item, i) => ({ ...item, id: `item-${i + 1}` })),
  upiId: sampleInvoice.upi.id,
  showQr: true,
  payNow: true,
  paid: false,
  notes: "Thanks for the quick approvals. Payment within 15 days please.",
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const printDate = (iso: string) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : "")

/** Maps the editor draft to what the invoice renderer prints. */
export function toInvoice(d: Draft): SampleInvoice {
  const client = clients.find((c) => c.id === d.clientId) ?? clients[0]
  const pos = states.find((s) => s.code === d.posCode)
  const clientState = states.find((s) => s.code === client.stateCode)
  return {
    ...sampleInvoice,
    number: d.number,
    issueDate: printDate(d.issueDate),
    dueDate: printDate(d.dueDate),
    billTo: {
      name: client.name,
      city: client.city,
      state: clientState?.name ?? "",
      stateCode: client.stateCode,
      address: client.address,
      email: client.email,
    },
    placeOfSupply: pos ? `${pos.name} (${pos.code})` : "",
    items: d.items,
    // Same state as the seller: CGST + SGST. Different state: IGST.
    tax: { type: d.posCode === sellerStateCode ? "CGST+SGST" : "IGST", rate: d.gstRate },
    upi: { ...sampleInvoice.upi, id: d.upiId },
    // A receipt is proof of payment, so it always reads as paid.
    status: d.paid || d.kind === "receipt" ? "PAID" : "DUE",
    kind: d.kind,
    receipt: { number: d.receiptNumber, method: d.paymentMethod, paidDate: printDate(d.issueDate) },
    display: { showQr: d.showQr, payNow: d.payNow },
    notes: d.notes,
  }
}

let nextId = 100

export function useInvoiceDraft() {
  const [draft, setDraft] = React.useState<Draft>(initialDraft)
  const [saving, setSaving] = React.useState(false)
  const first = React.useRef(true)

  // UI-only autosave indicator: "Saving…" briefly after each change.
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaving(true)
    const t = setTimeout(() => setSaving(false), 700)
    return () => clearTimeout(t)
  }, [draft])

  const update = React.useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }, [])

  const setClient = React.useCallback((clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    setDraft((d) => ({ ...d, clientId, posCode: client?.stateCode ?? d.posCode }))
  }, [])

  const updateItem = React.useCallback((id: string, patch: Partial<InvoiceItem>) => {
    setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  }, [])

  const addItem = React.useCallback(() => {
    nextId += 1
    setDraft((d) => ({ ...d, items: [...d.items, { id: `item-${nextId}`, name: "", sac: "998391", qty: 1, rate: 0 }] }))
  }, [])

  const removeItem = React.useCallback((id: string) => {
    setDraft((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }))
  }, [])

  const invoice = React.useMemo(() => toInvoice(draft), [draft])

  return { draft, invoice, saving, update, setClient, updateItem, addItem, removeItem }
}

export type InvoiceDraftApi = ReturnType<typeof useInvoiceDraft>
