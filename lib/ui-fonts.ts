import { IBM_Plex_Sans, Inter, JetBrains_Mono, Literata, Manrope, Source_Serif_4 } from "next/font/google"

/**
 * Optional interface fonts (Settings → Preferences → Font). Geist is the
 * default and loads in the root layout; these only declare @font-face, are
 * not preloaded, and the browser fetches one only when it's chosen.
 * Invoices keep their own type: documents use --font-geist-* directly.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false })
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap", preload: false })
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false })
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap", preload: false })
const literata = Literata({ subsets: ["latin"], variable: "--font-literata", display: "swap", preload: false })
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", preload: false })

export const uiFontVars = [inter, plex, manrope, sourceSerif, literata, jetbrains].map((f) => f.variable).join(" ")
