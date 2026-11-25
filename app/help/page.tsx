import type { Metadata } from "next"
import Link from "next/link"
import { FileTextIcon, IndianRupeeIcon, PercentIcon, ShieldCheckIcon } from "lucide-react"

import { FeedbackForm } from "@/components/dashboard/feedback"
import { Keys } from "@/components/dashboard/shortcuts-dialog"
import { Callout, DocSection, Faq, H3, List, Step, Steps } from "@/components/docs/content"
import { DocsShell } from "@/components/docs/docs-shell"
import type { DocsNavGroup } from "@/components/docs/docs-nav"

export const metadata: Metadata = {
  title: "Help center · PrettyBills",
  description: "How to make a GST invoice with PrettyBills, share it, get paid by UPI, and manage your account.",
}

const nav: DocsNavGroup[] = [
  {
    title: "Get started",
    items: [
      { id: "first-invoice", label: "Your first invoice" },
      { id: "guest-or-account", label: "Guest or account" },
      { id: "business", label: "Your business details" },
      { id: "clients-items", label: "Clients and items" },
    ],
  },
  {
    title: "GST",
    items: [
      { id: "gst", label: "GST, explained" },
      { id: "exports", label: "Exports and reverse charge" },
    ],
  },
  {
    title: "Send and get paid",
    items: [
      { id: "payments", label: "Getting paid" },
      { id: "sharing", label: "Sharing your invoice" },
      { id: "look", label: "Templates and signature" },
    ],
  },
  {
    title: "Account",
    items: [
      { id: "account", label: "Account and security" },
      { id: "shortcuts", label: "Keyboard shortcuts" },
      { id: "faq", label: "Questions" },
      { id: "contact", label: "Contact support" },
    ],
  },
]

const popular = [
  { href: "#first-invoice", icon: FileTextIcon, title: "Make your first invoice", body: "From blank to PDF in about a minute." },
  { href: "#gst", icon: PercentIcon, title: "CGST, SGST or IGST?", body: "How PrettyBills picks the right tax." },
  { href: "#payments", icon: IndianRupeeIcon, title: "Get paid by UPI", body: "Add a QR code clients can scan." },
  { href: "#account", icon: ShieldCheckIcon, title: "Account and security", body: "Passwords, Google and devices." },
]

export default function HelpPage() {
  return (
    <DocsShell site="/help" eyebrow="Help center" title="How can we help?" description="Everything about making GST invoices with PrettyBills: filling them in, the tax rules, sharing, getting paid and your account." nav={nav}>
      <div className="mb-12 grid gap-3 sm:grid-cols-2">
        {popular.map((p) => (
          <a key={p.href} href={p.href} className="group flex items-start gap-3 rounded-xl border bg-background p-4 transition-[border-color,box-shadow] hover:border-brand/40 hover:shadow-[0_6px_24px_-12px_color-mix(in_oklab,var(--brand)_40%,transparent)]">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand dark:text-[#6da2ff]">
              <p.icon className="size-4.5" />
            </span>
            <span className="grid gap-0.5">
              <span className="text-[14px] font-semibold">{p.title}</span>
              <span className="text-[13px] text-muted-foreground">{p.body}</span>
            </span>
          </a>
        ))}
      </div>

      <DocSection id="first-invoice" title="Your first invoice" lead="No sign-up needed. Open the editor and you're already editing a new invoice.">
        <Steps>
          <Step title="Open the editor">
            Go to <Link href="/create">New invoice</Link>, or pick a design from <Link href="/templates">Templates</Link>. The form is on one side, and a live preview of the invoice is on the other.
          </Step>
          <Step title="Fill in your business">
            Your name, address and GSTIN go at the top of the invoice. Type your GSTIN and PrettyBills fills in your state and PAN for you.
          </Step>
          <Step title="Add your client">
            Their name, address and GSTIN (if they have one). Their state decides which GST applies, so get it right.
          </Step>
          <Step title="Add items">
            Each line has a name, HSN/SAC code, quantity, rate and GST rate. Press <Keys keys={["Enter"]} /> in the rate of the last item to add another line.
          </Step>
          <Step title="Download or share">
            Click <strong>PDF</strong> to download, or <strong>Share</strong> for print, a link or WhatsApp. Totals, tax and the amount in words are worked out for you.
          </Step>
        </Steps>
        <Callout tone="tip">Anything missing that an invoice needs is marked in red. Click <strong>Send invoice</strong> and the form jumps to the first thing to fix.</Callout>
      </DocSection>

      <DocSection id="guest-or-account" title="Guest or account" lead="Everything is free either way. An account is what makes your work stay.">
        <H3>As a guest</H3>
        <List>
          <li>You can make, preview, print and download invoices.</li>
          <li>Nothing is saved. Close or reload the tab and the invoice is gone, and the browser warns you first.</li>
          <li>Sending by email and share links need an account, because they need the invoice saved online.</li>
        </List>
        <H3>With a free account</H3>
        <List>
          <li>Invoices save themselves as you type, and open on any device.</li>
          <li>Send by email, share a link, and see when your client opens it.</li>
          <li>Your business details, payment details, terms and signature are filled in on every new invoice.</li>
        </List>
        <Callout title="Started as a guest?">
          Click <strong>Log in</strong> or <strong>Sign up</strong> from the dashboard and the invoice you&apos;re working on comes with you into your account.
        </Callout>
      </DocSection>

      <DocSection id="business" title="Your business details">
        <p>
          The Business section of the editor is what prints at the top of the invoice: name, legal name, GSTIN, PAN, address, contact details and your logo (PNG, JPG, SVG or WebP, up to 2 MB).
        </p>
        <p>
          To reuse them, tick <strong>Save changes to my business profile</strong> in the editor, or open <strong>Settings → Business details</strong> from the profile menu at the bottom of the sidebar. Every new invoice then starts with them.
        </p>
        <Callout tone="info">Saved details live in the browser you saved them in, for your account. Invoices themselves are saved online.</Callout>
      </DocSection>

      <DocSection id="clients-items" title="Clients and items">
        <p>Pick a client you&apos;ve billed before, or type a new one. Choose whether they&apos;re a business (B2B), a consumer (B2C) or overseas (export), since that changes what the invoice must show.</p>
        <p>
          Items can come from your saved list or be typed fresh. Each has an HSN (goods) or SAC (services) code, a unit, a rate, an optional discount and a GST rate. Use <strong>Exempt</strong> or <strong>Nil-rated</strong> for supplies without GST.
        </p>
        <p>Delivery charges and other extras go under <strong>Tax &amp; totals</strong>, along with an invoice-wide discount, TCS and rounding.</p>
      </DocSection>

      <DocSection id="gst" title="GST, explained" lead="PrettyBills works out the tax from two things: your state and the place of supply.">
        <List>
          <li>
            <strong>Same state</strong>: the GST is split in half into CGST and SGST. 18% becomes 9% CGST + 9% SGST.
          </li>
          <li>
            <strong>Different states</strong>: the whole rate is charged as IGST.
          </li>
          <li>
            <strong>Place of supply</strong> is normally your client&apos;s state. Change it in the Client section if goods are delivered somewhere else.
          </li>
          <li>
            <strong>Not registered for GST?</strong> Set the invoice title to <em>Bill of Supply</em> in Invoice details (the editor reminds you when there&apos;s no GSTIN) and use 0% or Exempt on your items. Add a GSTIN later and the title switches back to <em>Tax Invoice</em>.
          </li>
        </List>
        <p>Every tax line on the invoice shows the rate and the amount it was charged on, and the total is written out in words in rupees and paise.</p>
        <Callout tone="warn">PrettyBills does the arithmetic, but you&apos;re responsible for the rates and codes you choose. Check with your CA if you&apos;re unsure.</Callout>
      </DocSection>

      <DocSection id="exports" title="Exports and reverse charge">
        <p>
          For a client abroad, choose <strong>Export</strong> as the client type and pick their currency. Exports are zero-rated, so no GST is added. If you export under a Letter of Undertaking, add your <strong>LUT / bond number</strong> and it&apos;s printed on the invoice.
        </p>
        <p>
          Turn on <strong>Reverse charge</strong> in Invoice details when your client pays the GST instead of you. The invoice then states that tax is payable on reverse charge.
        </p>
      </DocSection>

      <DocSection id="payments" title="Getting paid">
        <List>
          <li>
            <strong>UPI QR</strong>: add your UPI ID and a QR code for the balance due is printed on the invoice. Your client scans it with any UPI app.
          </li>
          <li>
            <strong>Bank transfer</strong>: add account holder, number, IFSC and bank, and they print in a payment box.
          </li>
          <li>
            <strong>Part payments</strong>: enter an amount already paid and the invoice shows the balance due.
          </li>
          <li>
            <strong>Payment terms</strong> (Due on receipt, Net 7, Net 15, Net 30 and more) set the due date for you.
          </li>
        </List>
      </DocSection>

      <DocSection id="sharing" title="Sharing your invoice">
        <List>
          <li>
            <strong>PDF</strong>: downloads exactly what the preview shows. There&apos;s also a version without the background colour, for printing.
          </li>
          <li>
            <strong>Print</strong>: from the Share menu.
          </li>
          <li>
            <strong>Link and WhatsApp</strong> (account): a private link to a web page of the invoice your client can view and download. You can switch the link off at any time.
          </li>
          <li>
            <strong>Email</strong> (account): send from the editor with the PDF attached and the link included. Replies go to your business email.
          </li>
        </List>
        <p>When your client opens a link, the invoice is marked <strong>Viewed</strong>.</p>
      </DocSection>

      <DocSection id="look" title="Templates and signature">
        <p>Pick from nine templates, choose a white or black page, and choose which columns to show. The preview updates as you change things.</p>
        <p>Sign by drawing, typing your name in a handwriting style, or uploading an image, and add a company stamp if you use one. Save it once and it&apos;s on every invoice.</p>
      </DocSection>

      <DocSection id="account" title="Account and security">
        <List>
          <li>
            <strong>Log in</strong> with your email and password, or with Google.
          </li>
          <li>
            <strong>Forgot your password?</strong> Use <Link href="/forgot-password">Forgot password</Link> on the login page and we&apos;ll email you a link to choose a new one.
          </li>
          <li>
            <strong>Change your name or password</strong> in <strong>Settings → Profile</strong>. Signed up with Google? You can add a password there too.
          </li>
          <li>
            <strong>Lost a device?</strong> <strong>Settings → Profile → Log out other devices</strong> signs you out everywhere else.
          </li>
          <li>
            <strong>Delete your account</strong>: send a request from <strong>Settings → Profile</strong> or the form below, and we&apos;ll remove your account and everything in it.
          </li>
        </List>
      </DocSection>

      <DocSection id="shortcuts" title="Keyboard shortcuts" lead="Press ? anywhere in the dashboard to see them all. On a Mac, use ⌘ instead of Ctrl.">
        <div className="divide-y rounded-lg border bg-background">
          {(
            [
              ["Save draft", ["Ctrl", "S"]],
              ["Undo", ["Ctrl", "Z"]],
              ["Redo", ["Ctrl", "Shift", "Z"]],
              ["Form, preview, side by side", ["Alt", "1 / 2 / 3"]],
              ["Open settings", ["Ctrl", ","]],
              ["Show or hide the sidebar", ["Ctrl", "B"]],
              ["All shortcuts", ["?"]],
            ] as const
          ).map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]">
              {label}
              <Keys keys={[...keys]} />
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection id="faq" title="Questions">
        <div className="grid gap-2">
          <Faq q="Is PrettyBills really free?">Yes. Making, downloading, sending and sharing invoices is free. A paid plan may come later for teams and extras, and what&apos;s free now stays free.</Faq>
          <Faq q="Do I need a GSTIN?">No. Without one, title the invoice Bill of Supply and don&apos;t charge GST. Add a GSTIN any time.</Faq>
          <Faq q="Can I use it on my phone?">Yes. On a small screen, switch between the form and the preview with the tabs at the top.</Faq>
          <Faq q="Can I change an invoice after sending it?">Yes. Edit it as usual and the shared link shows the latest version. If you emailed a PDF, send the corrected one again.</Faq>
          <Faq q="Who can see my invoices?">Only you, unless you share a link. A link works only while it&apos;s switched on, and its address can&apos;t be guessed.</Faq>
          <Faq q="Is there an API?">
            Yes. See the <Link href="/developers">developer docs</Link>.
          </Faq>
        </div>
      </DocSection>

      <DocSection id="contact" title="Contact support" lead="Stuck, found a bug, or want something added? Tell us here. Every message is read by the people building PrettyBills.">
        <div className="max-w-lg overflow-hidden rounded-xl border bg-background p-4">
          <FeedbackForm source="help" />
        </div>
      </DocSection>
    </DocsShell>
  )
}
