import type { Metadata } from "next"
import Link from "next/link"

import { CodeBlock } from "@/components/docs/code-block"
import { Callout, Code, DocSection, Endpoint, Fields, H3, List } from "@/components/docs/content"
import { DocsShell } from "@/components/docs/docs-shell"
import type { DocsNavGroup } from "@/components/docs/docs-nav"

export const metadata: Metadata = {
  title: "Developer docs · PrettyBills",
  description: "The PrettyBills invoice API: the invoice object, endpoints, PDF rendering, share links, GST maths and errors.",
}

const nav: DocsNavGroup[] = [
  {
    title: "Overview",
    items: [
      { id: "introduction", label: "Introduction" },
      { id: "authentication", label: "Authentication" },
      { id: "conventions", label: "Conventions" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "invoice-object", label: "The invoice object" },
      { id: "invoices", label: "Invoices" },
      { id: "pdf", label: "PDF rendering" },
      { id: "sharing", label: "Share links" },
      { id: "sending", label: "Sending by email" },
      { id: "clients-items", label: "Clients and items" },
      { id: "workspace", label: "Workspace defaults" },
      { id: "public", label: "Public endpoints" },
    ],
  },
  {
    title: "Guides",
    items: [
      { id: "gst-maths", label: "GST maths" },
      { id: "errors", label: "Errors and limits" },
      { id: "roadmap", label: "API keys and webhooks" },
    ],
  },
]

const ORIGIN = "https://prettybill.in"

export default function DevelopersPage() {
  return (
    <DocsShell site="/developers" eyebrow="Developer docs" title="Build with PrettyBills" description="The HTTP API behind the PrettyBills editor: create and save GST invoices, render pixel-perfect PDFs, share public links and send by email." nav={nav}>
      <DocSection id="introduction" title="Introduction">
        <p>
          Everything the editor does goes through a small JSON API under <Code>/api</Code>. An invoice is one JSON document. You save it whole, and the server renders PDFs and public pages from exactly what you saved, using the same maths as the editor.
        </p>
        <Callout title="Early access">
          The API is the one the app uses today, authenticated by the login session. API keys for server-to-server use and webhooks are next; see <a href="#roadmap">API keys and webhooks</a>. Endpoints may still change before they&apos;re versioned.
        </Callout>
      </DocSection>

      <DocSection id="authentication" title="Authentication">
        <p>
          Requests are authenticated by the Supabase session cookie set when you log in at <Link href="/login">/login</Link>, with email and password or Google. Calls from a page on the same origin send it automatically. Requests without a valid session get <Code>401</Code>.
        </p>
        <CodeBlock
          label="browser console, while logged in"
          code={`const res = await fetch("/api/invoices")
const { invoices } = await res.json()
// [{ id, number, businessId, status }, ...]`}
        />
        <p>An invoice belongs to the account that first saved it. Other accounts get <Code>404</Code> for it, never <Code>403</Code>, so ids can&apos;t be probed.</p>
      </DocSection>

      <DocSection id="conventions" title="Conventions">
        <List>
          <li>
            <strong>Money is integer paise.</strong> ₹1,234.50 is <Code>123450</Code>. Never send floats for amounts.
          </li>
          <li>
            <strong>Dates are ISO</strong> <Code>yyyy-mm-dd</Code> strings, in the business&apos;s local calendar. Timestamps are full ISO 8601 in UTC.
          </li>
          <li>
            <strong>States are GST state codes</strong>, the first two digits of a GSTIN: <Code>27</Code> is Maharashtra, <Code>96</Code> means another country.
          </li>
          <li>
            <strong>Ids</strong> are strings of letters, digits, <Code>_</Code> and <Code>-</Code>, up to 96 characters. You choose them when creating an invoice.
          </li>
          <li>
            <strong>Bodies</strong> are JSON, sent with <Code>content-type: application/json</Code>. An invoice is always wrapped: <Code>{"{ \"invoice\": { … } }"}</Code>.
          </li>
        </List>
      </DocSection>

      <DocSection id="invoice-object" title="The invoice object" lead="The main fields. The full TypeScript type is Invoice in lib/invoice/types.ts.">
        <Fields
          rows={[
            ["id", "string", "Your id for the invoice. Fixed once created."],
            ["number", "string", "Printed invoice number, e.g. INV/26-27/001. The editor keeps numbers unique per account."],
            ["title", "enum", "Tax Invoice, Invoice or Bill of Supply."],
            ["status", "enum", "draft, sent, viewed, partially_paid, paid, overdue or void. sent and viewed are set by the server."],
            ["templateId", "string", "One of the nine template slugs, e.g. standard."],
            ["issueDate / dueDate", "date", "yyyy-mm-dd."],
            ["paymentTerms", "enum", "due_on_receipt, net_7, net_15, net_30, net_45, net_60 or custom."],
            ["currency", "string", "ISO code. INR unless exporting."],
            ["from", "Business", "Your name, GSTIN, PAN, address, contact details and optional logo."],
            ["billTo", "Party", "The client. shipTo is optional."],
            ["placeOfSupply", "string", "GST state code that decides CGST+SGST or IGST."],
            ["supplyType", "enum", "b2b, b2c or export."],
            ["items", "LineItem[]", "name, hsnSac, qty (up to 3 decimals), unit, rate (paise), discount, taxRate."],
            ["invoiceDiscount", "Discount", "Optional. { kind: percent | amount, value }; amount is in paise."],
            ["charges", "Charge[]", "Extras such as delivery, each with its own taxRate."],
            ["roundOff", "boolean", "Round the total to the nearest rupee."],
            ["payment", "object", "UPI QR, bank details, instructions and amountPaid (paise)."],
            ["linkActive", "boolean", "Whether the public link works. publicToken is set by the server."],
            ["revision", "number", "Goes up by one when an invoice is edited after it was sent."],
          ]}
        />
      </DocSection>

      <DocSection id="invoices" title="Invoices">
        <Endpoint method="GET" path="/api/invoices" auth="Session">
          <p>
            A page of your invoices as summaries (no document), the same lists the app shows. Filter with <Code>bucket</Code>: <Code>draft</Code>, <Code>sent</Code> (awaiting payment, not late), <Code>overdue</Code>, <Code>paid</Code>, <Code>void</Code> or <Code>all</Code>. Search with <Code>q</Code> (number or client name), narrow with <Code>client</Code>, page with <Code>offset</Code> and <Code>limit</Code> (max 100).
          </p>
          <CodeBlock
            label="GET /api/invoices?bucket=overdue&limit=2"
            code={`{
  "invoices": [{
    "id": "inv_8f2k", "number": "INV/26-27/014", "status": "viewed", "bucket": "overdue",
    "clientName": "Monsoon Media", "issueDate": "2026-10-20", "dueDate": "2026-11-04",
    "total": 590000, "amountPaid": 0, "balanceDue": 590000, "daysPastDue": 21,
    "sentAt": "2026-10-20T09:12:44Z", "viewedAt": "2026-10-21T04:02:10Z", "paidAt": null
  }],
  "hasMore": true
}`}
          />
        </Endpoint>
        <Endpoint method="GET" path="/api/invoices/overview" auth="Session">
          <p>
            Counts and totals in one call: <Code>all</Code>, <Code>drafts</Code>, <Code>sent</Code>, <Code>overdue</Code>, <Code>paid</Code>, <Code>outstanding</Code>, <Code>overdueAmount</Code>, <Code>collectedMonth</Code> and more. Overdue is worked out in Indian time.
          </p>
        </Endpoint>
        <Endpoint method="GET" path="/api/invoices/{id}" auth="Session">
          <p>
            Returns <Code>{"{ invoice }"}</Code>, or <Code>404</Code> if it doesn&apos;t exist or isn&apos;t yours.
          </p>
        </Endpoint>
        <Endpoint method="PUT" path="/api/invoices/{id}" auth="Session">
          <p>
            Creates or replaces the invoice. The body&apos;s <Code>invoice.id</Code> must match the path. Server-owned fields (<Code>publicToken</Code>, <Code>sentAt</Code>) are kept from the stored copy whatever you send.
          </p>
          <CodeBlock
            label="request"
            code={`await fetch("/api/invoices/inv_8f2k", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ invoice }),
})
// 200 { "ok": true, "savedAt": "2026-11-25T09:12:44.120Z" }`}
          />
        </Endpoint>
      </DocSection>

      <DocSection id="pdf" title="PDF rendering">
        <Endpoint method="POST" path="/api/invoices/{id}/pdf" auth="Session or guest">
          <p>
            Renders the posted invoice to an A4 PDF, identical to the editor preview, and returns it as <Code>application/pdf</Code> with a ready filename. Nothing is stored. Send <Code>colorless: true</Code> for a print-friendly version on a white page.
          </p>
          <CodeBlock
            label="request"
            code={`const res = await fetch(\`/api/invoices/\${invoice.id}/pdf\`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ invoice, colorless: false }),
})
const blob = await res.blob()`}
          />
          <p>Without a session this works too, limited to 12 PDFs a minute per IP address.</p>
        </Endpoint>
        <Endpoint method="GET" path="/api/invoices/{id}/pdf" auth="Session">
          <p>
            The PDF of a saved invoice, without posting it. Add <Code>?colorless=1</Code> for the print version. This is what the Download buttons in invoice lists use.
          </p>
        </Endpoint>
      </DocSection>

      <DocSection id="sharing" title="Share links">
        <Endpoint method="POST" path="/api/invoices/{id}/share" auth="Session">
          <p>
            Creates the invoice&apos;s public link the first time, and switches it on or off with <Code>active</Code>. The token is random and can&apos;t be guessed. Posting the current <Code>invoice</Code> saves it first.
          </p>
          <CodeBlock label="request and response" code={`POST /api/invoices/inv_8f2k/share\n{ "invoice": { … }, "active": true }\n\n200 { "token": "k3j9…", "url": "${ORIGIN}/i/k3j9…", "active": true }`} />
          <p>
            The link opens a public page at <Code>/i/{"{token}"}</Code>, where your client can read and download the invoice. Switch it off and the page and its PDF return <Code>404</Code>.
          </p>
        </Endpoint>
      </DocSection>

      <DocSection id="sending" title="Sending by email">
        <Endpoint method="POST" path="/api/invoices/{id}/send" auth="Session">
          <p>Emails the invoice, optionally with the PDF attached and the public link included, then marks it sent.</p>
          <Fields
            rows={[
              ["invoice", "Invoice", "The invoice to send. It must pass validation (every required field filled)."],
              ["to / cc / bcc", "string[]", "Recipients. At least one in to, at most 20 in total."],
              ["subject", "string", "Email subject."],
              ["message", "string", "Plain text. {link} is replaced with the public link."],
              ["attachPdf", "boolean", "Attach the rendered PDF."],
              ["includeLink", "boolean", "Create the public link if needed."],
              ["copyMe", "boolean", "Bcc the business email."],
            ]}
          />
          <p>
            Replies go to <Code>invoice.from.email</Code>. Returns <Code>{"{ ok, delivered, sentAt, status, publicToken, summary }"}</Code>. A <Code>422</Code> with <Code>firstInvalid</Code> means a required field is missing.
          </p>
        </Endpoint>
        <Callout tone="tip" title="Self-hosting">
          Delivery uses Resend when <Code>RESEND_API_KEY</Code> and <Code>INVOICE_FROM_EMAIL</Code> are set. In development without them, emails are written to <Code>.data/outbox</Code> so you can test the flow.
        </Callout>
      </DocSection>

      <DocSection id="clients-items" title="Clients and items" lead="The people you bill and the things you sell. Ids are yours to choose (letters, digits, _ and -, up to 64).">
        <Endpoint method="POST" path="/api/clients" auth="Session">
          <p>
            Creates or updates a client. Body: <Code>{"{ client: { id, name, gstin?, pan?, email?, phone?, address: { line1, city, pin, stateCode, country } } }"}</Code>.
          </p>
        </Endpoint>
        <Endpoint method="DELETE" path="/api/clients/{id}" auth="Session">
          <p>Removes a client. Invoices keep the copy of the client&apos;s details they were made with.</p>
        </Endpoint>
        <Endpoint method="POST" path="/api/items" auth="Session">
          <p>
            Creates or updates an item. Body: <Code>{"{ item: { id, name, description?, hsnSac?, unit, rate, taxRate, taxCategory } }"}</Code>, rate in paise. Names are unique per account (ignoring case): saving an item with an existing name replaces that item. <Code>DELETE /api/items/{"{id}"}</Code> removes one.
          </p>
        </Endpoint>
      </DocSection>

      <DocSection id="workspace" title="Workspace defaults" lead="What every new invoice starts with.">
        <Endpoint method="GET" path="/api/workspace" auth="Session">
          <p>
            Everything the editor needs in one request: <Code>settings</Code> (business, payment, terms, signature), <Code>clients</Code>, <Code>items</Code> and the invoice <Code>numbers</Code> already used.
          </p>
        </Endpoint>
        <Endpoint method="PUT" path="/api/workspace/settings" auth="Session">
          <p>
            Saves any of <Code>business</Code>, <Code>payment</Code>, <Code>terms</Code> and <Code>signature</Code>; keys you leave out are unchanged and <Code>null</Code> clears one. <Code>GET</Code> returns the current settings.
          </p>
        </Endpoint>
      </DocSection>

      <DocSection id="public" title="Public endpoints" lead="Used by the public invoice page. No session needed; they only work while the link is switched on.">
        <Endpoint method="GET" path="/api/public/{token}/pdf" auth="Public">
          <p>Downloads the shared invoice as a PDF, and records a download.</p>
        </Endpoint>
        <Endpoint method="POST" path="/api/public/{token}/view" auth="Public">
          <p>
            Records a view. The first view moves a <Code>sent</Code> invoice to <Code>viewed</Code>. Returns <Code>{"{ ok, first }"}</Code>.
          </p>
        </Endpoint>
      </DocSection>

      <DocSection id="gst-maths" title="GST maths" lead="The server, the editor and the PDF all use one function, so totals always agree. In order, in integer paise:">
        <ol className="grid list-decimal gap-1.5 pl-5 marker:text-muted-foreground">
          <li>Line amount = qty × rate − line discount, rounded half-up per line.</li>
          <li>An invoice discount is spread across lines in proportion to their amounts, so the parts add up exactly.</li>
          <li>Tax per line = taxable amount × GST rate. Same state as the place of supply: half CGST, half SGST. Different state: IGST. Exempt, nil-rated and export lines: 0.</li>
          <li>Extra charges are taxed at their own rate.</li>
          <li>Total = taxable amounts + tax + charges (+ TCS).</li>
          <li>With round-off on, the total is rounded to the nearest rupee and the difference is shown as its own line.</li>
          <li>Balance due = total − amount paid.</li>
        </ol>
        <H3>Example</H3>
        <p>Two hours of design at ₹1,500 with 18% GST, inside one state:</p>
        <CodeBlock label="totals" code={`taxable   300000   (₹3,000.00)\nCGST 9%    27000   (₹270.00)\nSGST 9%    27000   (₹270.00)\ntotal     354000   (₹3,540.00)`} />
      </DocSection>

      <DocSection id="errors" title="Errors and limits">
        <p>
          Errors are JSON with a human-readable message: <Code>{"{ \"error\": \"…\" }"}</Code>. Show it to your user as-is.
        </p>
        <Fields
          rows={[
            ["400", "Invalid request", "The body isn't valid JSON, or the invoice id doesn't match the path."],
            ["401", "Not logged in", "No valid session. Log in again."],
            ["404", "Not found", "The invoice doesn't exist, isn't yours, or its link is switched off."],
            ["409", "Conflict", "That invoice number is already used on another of your invoices."],
            ["422", "Can't do that yet", "Validation failed, e.g. missing required fields or bad email addresses."],
            ["429", "Slow down", "Rate limited. The retry-after header says how many seconds to wait."],
            ["503", "Not set up", "The database tables don't exist yet (self-hosting: run the migrations)."],
            ["5xx", "Our side", "Rendering or email delivery failed. Safe to retry."],
          ]}
        />
        <p>Rate limits: PDFs without a session, 12 a minute per IP address. Invoices are limited to about 15 MB of JSON, mostly images such as logos and signatures.</p>
      </DocSection>

      <DocSection id="roadmap" title="API keys and webhooks" lead="Coming next, so you can use PrettyBills from your own server.">
        <List>
          <li>
            <strong>API keys</strong>, created in the dashboard, sent as <Code>Authorization: Bearer pb_live_…</Code>.
          </li>
          <li>
            <strong>Webhooks</strong> for <Code>invoice.sent</Code>, <Code>invoice.viewed</Code> and <Code>invoice.paid</Code>, signed so you can verify they came from us.
          </li>
          <li>A versioned base path, so changes never break your integration.</li>
        </List>
        <p>
          Want them sooner, or need something else? <Link href="/help#contact">Tell us what you&apos;re building</Link>.
        </p>
      </DocSection>
    </DocsShell>
  )
}
