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
  { label: "Create an invoice", href: "/create" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Help center", href: HELP_URL },
  { label: "Developers", href: DOCS_URL },
  // TODO before launch: add /privacy and /terms pages (Razorpay needs them), then list them here.
  // They were linked before the pages existed, so they 404'd; a GST calculator page doesn't exist yet either.
] as const

export const socials = [
  { key: "instagram", label: "Instagram", href: "https://instagram.com/hilal_11_n" },
  { key: "x", label: "X", href: "https://x.com/Hilal3884871845" },
  { key: "github", label: "GitHub", href: "https://github.com/hilal-11" },
  { key: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/hilal-ab5466347/" },
] as const
