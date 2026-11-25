import {
  BrushIcon,
  FeatherIcon,
  FlowerIcon,
  FrameIcon,
  LandmarkIcon,
  type LucideIcon,
  ScrollIcon,
  ScrollTextIcon,
  ShapesIcon,
  SproutIcon,
} from "lucide-react"

/**
 * Invoice templates. Each is named after an art form or ancient medium that
 * matches its look. `slug` is the stable id stored on invoices (`templateId`).
 */
export type TemplateCategory = "General" | "Freelancer" | "Retail" | "Restaurant" | "Construction" | "Medical" | "Photography" | "Receipt-style"

export interface TemplateMeta {
  slug: string
  name: string
  description: string
  category: TemplateCategory
  tags: string[]
  icon: LucideIcon
  size: "a4" | "80mm"
  recommended?: boolean
}

export const DEFAULT_TEMPLATE_ID = "standard"

export const TEMPLATES: TemplateMeta[] = [
  {
    slug: "standard",
    name: "Folio",
    description: "The standard layout. Complete, plain, every GST field in place.",
    category: "General",
    tags: ["A4", "GST", "UPI QR"],
    icon: ScrollTextIcon,
    size: "a4",
    recommended: true,
  },
  {
    slug: "classic-ledger",
    name: "Codex",
    description: "Serif type and double rules, like a bound ledger.",
    category: "General",
    tags: ["A4", "GST"],
    icon: LandmarkIcon,
    size: "a4",
  },
  {
    slug: "minimal-mono",
    name: "Sumi",
    description: "Ink-black minimalism. Lots of white space.",
    category: "Freelancer",
    tags: ["A4", "GST"],
    icon: FeatherIcon,
    size: "a4",
  },
  {
    slug: "studio-bold",
    name: "Bauhaus",
    description: "A heavy header band and bold type for studios.",
    category: "Freelancer",
    tags: ["A4", "GST"],
    icon: ShapesIcon,
    size: "a4",
  },
  {
    slug: "kirana-clean",
    name: "Madhubani",
    description: "Warm accent rail and striped rows for shops.",
    category: "Retail",
    tags: ["A5", "GST", "UPI QR"],
    icon: FlowerIcon,
    size: "a4",
  },
  {
    slug: "cafe-receipt",
    name: "Papyrus",
    description: "Narrow thermal-printer strip for counters.",
    category: "Receipt-style",
    tags: ["80mm", "GST", "UPI QR"],
    icon: ScrollIcon,
    size: "80mm",
  },
  {
    slug: "site-work",
    name: "Ziggurat",
    description: "Hazard-stripe header and boxed rows for site work.",
    category: "Construction",
    tags: ["A4", "GST"],
    icon: BrushIcon,
    size: "a4",
  },
  {
    slug: "clinic-care",
    name: "Lotus",
    description: "Soft tinted header, calm and clinical.",
    category: "Medical",
    tags: ["A4", "GST"],
    icon: SproutIcon,
    size: "a4",
  },
  {
    slug: "frame",
    name: "Fresco",
    description: "Gallery-style serif title for photographers.",
    category: "Photography",
    tags: ["A4", "GST"],
    icon: FrameIcon,
    size: "a4",
  },
]

export const CATEGORY_ORDER: TemplateCategory[] = ["General", "Freelancer", "Retail", "Restaurant", "Construction", "Medical", "Photography", "Receipt-style"]

export function templateMeta(slug: string) {
  return TEMPLATES.find((t) => t.slug === slug) ?? TEMPLATES[0]
}
