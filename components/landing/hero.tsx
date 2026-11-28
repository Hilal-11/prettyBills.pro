import { HeroCopy } from "./hero-motion"
import { ProductShowcase } from "./product-showcase"
import { ArrowNudge, CtaLink } from "./primitives"

export function Hero() {
  return (
    <section aria-label="PrettyBills" className="relative isolate overflow-hidden pt-28 pb-6 sm:pt-36 sm:pb-10">
      {/* soft top light + framing guide lines */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(50%_60%_at_50%_0%,color-mix(in_oklab,var(--foreground)_7%,transparent),transparent)]" />
        <div className="absolute inset-0 mx-auto max-w-[1288px] border-x border-dashed border-border/70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        {/* dotted texture, fading out from the top */}
        <div className="absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(60%_70%_at_50%_0%,black,transparent)] opacity-70" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <HeroCopy
          actions={
            <>
              <CtaLink href="/create" event="cta_create_click" section="hero" className="h-8 px-3 text-[13px]">
                Create free invoice
                <ArrowNudge />
              </CtaLink>
              <CtaLink href="/templates" event="cta_templates_click" section="hero" variant="ghost" className="h-8 px-3 text-[13px] hover:bg-neutral-100 dark:hover:bg-neutral-800">
                Browse templates
              </CtaLink>
            </>
          }
        />

      </div>

      {/* the product tour gets the full content width */}
      <div className="mx-auto mt-14 max-w-[1288px] px-4 sm:mt-16 sm:px-6">
        <ProductShowcase />
      </div>
    </section>
  )
}
