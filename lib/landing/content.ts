/**
 * Landing page content: header, hero and footer.
 * Anything marked `PLACEHOLDER` must be confirmed before launch.
 */

export const DOCS_URL = "https://prettybill.dev"

export const navLinks = [
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Developers", href: DOCS_URL },
] as const

/** Template tabs in the hero preview. All render the same sample invoice. */
export const heroTemplates = [
  { slug: "minimal-mono", name: "Minimal Mono" },
  { slug: "classic-ledger", name: "Classic Ledger" },
  { slug: "frame", name: "Frame" },
  { slug: "cafe-receipt", name: "Café Receipt" },
] as const

export const footerLinks = [
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "GST calculator", href: "/tools/gst-calculator" },
  { label: "Docs", href: DOCS_URL },
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
