/**
 * "What's new" entries, newest first. Add a new entry at the top when you ship
 * something people will notice; its id switches the unread dot back on.
 */
export type ChangelogEntry = {
  id: string
  date: string // ISO yyyy-mm-dd
  tag: "New" | "Improved" | "Fixed"
  title: string
  body: string
  points?: string[]
}

export const changelog: ChangelogEntry[] = [
  {
    id: "2026-11-payments",
    date: "2026-11-25",
    tag: "New",
    title: "Payments, receipts and client balances",
    body: "Record what you've been paid, part or whole, and PrettyBills keeps every balance, status and receipt right for you.",
    points: [
      "Record payments by UPI, cash, bank transfer, cheque or card; invoices move to Partially paid and Paid by themselves",
      "A numbered receipt (RCPT/26-27/001) for every payment, in your invoice's design, to download or share on WhatsApp",
      "Payments page with filters and a CSV export for your accountant",
      "Each client's billed, received, outstanding and overdue, plus a statement of account",
      "Pro: receipts emailed to your client as you record the payment",
    ],
  },
  {
    id: "2026-11-pro",
    date: "2026-11-25",
    tag: "New",
    title: "PrettyBills Pro",
    body: "Everything you use today stays free. Pro adds one thing that costs us money: emailing invoices to clients straight from PrettyBills.",
    points: [
      "Email invoices in one click, with the PDF attached and replies going to you",
      "Up to 1,000 invoice emails a month",
      "No PrettyBills branding in your emails",
      "Coming to Pro: automatic reminders, scheduled and recurring sends",
      "See the plans at /pricing",
    ],
  },
  {
    id: "2026-11-workspace",
    date: "2026-11-25",
    tag: "New",
    title: "Your invoices, organised",
    body: "Everything you make is now saved to your account and sorted for you, on any device.",
    points: [
      "Dashboard: what you're owed, what's overdue, and what clients opened",
      "Drafts, Sent, Overdue and Paid, each with the actions that matter there",
      "Mark invoices paid and send WhatsApp reminders from the list",
      "A Clients page: everyone you bill, and what each one owes",
      "A Templates gallery to start an invoice from any design",
    ],
  },
  {
    id: "2026-11-settings",
    date: "2026-11-25",
    tag: "New",
    title: "Settings, shortcuts and a help center",
    body: "Your profile, business details and preferences now live in one place, and there's a proper help center.",
    points: [
      "Settings: edit your name, password and default business details",
      "Press ? anywhere in the dashboard to see every keyboard shortcut",
      "Ctrl S saves a draft",
      "Send feedback straight from the app",
      "Developer docs for the invoice API",
    ],
  },
  {
    id: "2026-11-guest",
    date: "2026-11-25",
    tag: "New",
    title: "Make invoices without an account",
    body: "Open the dashboard and start. Nothing is saved until you log in, and when you do, the invoice you were working on comes with you.",
  },
  {
    id: "2026-11-accounts",
    date: "2026-11-24",
    tag: "New",
    title: "Accounts and Google sign-in",
    body: "Sign up with email or Google. Signed-in invoices save themselves as you type and follow you to any device.",
  },
  {
    id: "2026-11-editor",
    date: "2026-11-20",
    tag: "Improved",
    title: "A faster invoice editor",
    body: "Live preview next to the form, undo and redo, nine templates, UPI QR codes, signatures and one-click PDF.",
  },
]

export const latestChangelogId = changelog[0]!.id
