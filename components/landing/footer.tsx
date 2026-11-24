import Link from "next/link"
import { FaGithub, FaInstagram, FaLinkedin, FaXTwitter } from "react-icons/fa6"

import { trackAttrs } from "@/lib/analytics"
import { DOCS_URL, footerLinks, socials } from "@/lib/landing/content"

import { Logo } from "./primitives"

const socialIcons = { instagram: FaInstagram, x: FaXTwitter, github: FaGithub, linkedin: FaLinkedin } as const

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden border-t">
      {/* faint perspective grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-56 [perspective:600px] [mask-image:linear-gradient(to_top,black,transparent)]"
      >
        <div className="absolute inset-x-[-50%] bottom-0 h-[200%] origin-bottom [transform:rotateX(60deg)] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:40px_40px] opacity-60" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <Logo />
            <p className="mt-2 text-[13px] text-muted-foreground">Free GST invoices for India.</p>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                  {...(link.href === DOCS_URL ? trackAttrs("dev_docs_click", "footer") : {})}
                  {...(link.href === "/templates" ? trackAttrs("cta_templates_click", "footer") : {})}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col-reverse justify-between gap-4 border-t border-dashed pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">© 2026 Prettybill · Made in Kashmir, India</p>
          <ul className="-ml-2 flex items-center gap-0.5 sm:ml-0" aria-label="Prettybill on social media">
            {socials.map((social) => {
              const Icon = socialIcons[social.key]
              return (
                <li key={social.key}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener"
                    aria-label={`Prettybill on ${social.label}`}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground transition-[color,background-color,scale] hover:bg-muted hover:text-foreground active:scale-90"
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </footer>
  )
}
