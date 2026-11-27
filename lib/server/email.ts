import "server-only"

/**
 * Sends email through Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Configure with RESEND_API_KEY and INVOICE_FROM_EMAIL. Errors come back as
 * EmailError with a message a person can act on.
 */

export type Attachment = { filename: string; content: string } // base64

export type OutgoingEmail = {
  fromName: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  subject: string
  html: string
  text: string
  attachments?: Attachment[]
  /** Same key within 24h = same email: protects against double clicks and retries. */
  idempotencyKey?: string
  tags?: { name: string; value: string }[]
}

export class EmailError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = "EmailError"
    this.status = status
  }
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.INVOICE_FROM_EMAIL)
}

/** "Rahul Design Studio" <billing@…>, with characters that would break the header removed. */
function fromHeader(name: string, email: string) {
  const clean = name.replace(/["<>\r\n\\]/g, "").trim().slice(0, 80) || "PrettyBills"
  return `"${clean}" <${email}>`
}

/** Resend allows 40 MB per email including attachments; base64 adds a third. */
const MAX_ATTACHMENT_BYTES = 38 * 1024 * 1024

export async function sendEmail(email: OutgoingEmail): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.INVOICE_FROM_EMAIL
  if (!apiKey || !from) throw new EmailError("Email isn't set up yet. Add RESEND_API_KEY and INVOICE_FROM_EMAIL.", 503)

  const bytes = (email.attachments ?? []).reduce((sum, a) => sum + Math.round((a.content.length * 3) / 4), 0)
  if (bytes > MAX_ATTACHMENT_BYTES) throw new EmailError("The attachments are too big to email (over 38 MB). Remove some, or share a link instead.", 413)

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(email.idempotencyKey ? { "idempotency-key": email.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: fromHeader(email.fromName, from),
      to: email.to,
      cc: email.cc?.length ? email.cc : undefined,
      bcc: email.bcc?.length ? email.bcc : undefined,
      reply_to: email.replyTo || undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.attachments?.length ? email.attachments : undefined,
      tags: email.tags,
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch((error: unknown) => {
    throw new EmailError(error instanceof Error && error.name === "TimeoutError" ? "The email service took too long to answer. Try again." : "Couldn't reach the email service. Try again.")
  })

  const body = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null
  if (res.ok && body?.id) return { id: body.id }
  throw new EmailError(explain(res.status, body?.message ?? "", body?.name ?? ""), res.status === 429 ? 429 : 502)
}

/** Resend's error, in words that say what to do. */
function explain(status: number, message: string, name: string) {
  // test sender: only the account owner's own address can receive
  const own = message.match(/own email address \(([^)]+)\)/)
  if (own || /verify a domain/i.test(message)) {
    return `Email is in test mode, so it can only go to ${own?.[1] ?? "the Resend account's own address"}. To email clients, verify your domain at resend.com/domains and set INVOICE_FROM_EMAIL to an address on it.`
  }
  if (/domain is not verified|not verified/i.test(message)) return "The sending address's domain isn't verified in Resend yet. Finish verifying it at resend.com/domains."
  if (status === 401 || status === 403 || name === "invalid_api_key") return "The email service rejected our key. Check RESEND_API_KEY."
  if (status === 429) return "Too many emails in a short time. Wait a minute and send again."
  if (status === 422) return `The email service couldn't send this: ${message || "check the recipients and attachments"}.`
  return `The email service couldn't send this${message ? `: ${message}` : ""}. Try again.`
}
