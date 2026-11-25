/**
 * Landing page content: header, hero and footer.
 * Anything marked `PLACEHOLDER` must be confirmed before launch.
 */

export const DOCS_URL = "/developers"
export const HELP_URL = "/help"

export const navLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Developers", href: DOCS_URL },
  // Where signed-in users create and manage invoices. Route not built yet.
] as const

export const footerLinks = [
  { label: "Developers", href: DOCS_URL },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "GST calculator", href: "/tools/gst-calculator" },
  { label: "Help center", href: HELP_URL },
  // PLACEHOLDER: confirm privacy policy and terms URLs.
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
] as const

export const socials = [
  { key: "instagram", label: "Instagram", href: "https://instagram.com/prettybill" },
  { key: "x", label: "X", href: "https://x.com/prettybill" },
  { key: "github", label: "GitHub", href: "https://github.com/prettybill" },
  { key: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/company/prettybill" },
] as const
