/**
 * What each plan includes, as shown on /pricing. Only list what the app does
 * today; things on the way are marked `soon` so nobody pays for a promise.
 */

export type PlanLine = { label: string; soon?: boolean }

export const FREE_LINES: PlanLine[] = [
  { label: "Unlimited invoices, saved to your account" },
  { label: "9 professional templates" },
  { label: "GST worked out for you: CGST, SGST or IGST" },
  { label: "Your logo, signature, UPI QR and bank details" },
  { label: "Download the PDF or print it" },
  { label: "Share a link and see when it's opened" },
  { label: "WhatsApp sharing and payment reminders" },
  { label: "Record payments, with a numbered receipt for each" },
  { label: "Client balances and statements of account" },
  { label: "Clients and items remembered" },
  { label: "Dashboard: what you're owed and what's overdue" },
]

export const PRO_LINES: PlanLine[] = [
  { label: "Email invoices to clients in one click" },
  { label: "PDF attached, replies come to your inbox" },
  { label: "Up to 1,000 invoice emails a month" },
  { label: "No PrettyBills branding in your emails" },
  { label: "Receipts emailed as you record payments" },
  { label: "Automatic payment reminders", soon: true },
  { label: "Scheduled sending", soon: true },
  { label: "Recurring invoices, sent automatically", soon: true },
]

/** true = included, false = not, string = included with a note. */
export type Cell = boolean | string

export const COMPARE: { group: string; rows: { label: string; free: Cell; pro: Cell }[] }[] = [
  {
    group: "Make invoices",
    rows: [
      { label: "Invoices", free: "Unlimited", pro: "Unlimited" },
      { label: "Templates", free: "9", pro: "9" },
      { label: "CGST, SGST and IGST worked out", free: true, pro: true },
      { label: "Exports and reverse charge", free: true, pro: true },
      { label: "Your logo and signature", free: true, pro: true },
      { label: "UPI QR code and bank details", free: true, pro: true },
      { label: "Clients and items remembered", free: true, pro: true },
    ],
  },
  {
    group: "Share and get paid",
    rows: [
      { label: "PDF download and print", free: true, pro: true },
      { label: "Invoice link with view tracking", free: true, pro: true },
      { label: "WhatsApp sharing and reminders", free: true, pro: true },
      { label: "Track paid, overdue and outstanding", free: true, pro: true },
      { label: "Record payments (UPI, cash, bank, cheque…)", free: true, pro: true },
      { label: "Numbered receipts: PDF, link and WhatsApp", free: true, pro: true },
      { label: "Client balances, statements and CSV export", free: true, pro: true },
    ],
  },
  {
    group: "Email from PrettyBills",
    rows: [
      { label: "Email invoices with the PDF attached", free: false, pro: "1,000 a month" },
      { label: "Replies go to your business email", free: false, pro: true },
      { label: "No PrettyBills branding in emails", free: false, pro: true },
      { label: "Automatic payment reminders", free: false, pro: "Soon" },
      { label: "Scheduled sending", free: false, pro: "Soon" },
      { label: "Recurring invoices sent automatically", free: false, pro: "Soon" },
      { label: "Receipts emailed to clients", free: false, pro: true },
    ],
  },
]
