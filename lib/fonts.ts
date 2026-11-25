import { Allura, Caveat, Dancing_Script, Great_Vibes } from "next/font/google"

/** Signature fonts for the "Type" signature option (editor, print, public page). */
const dancing = Dancing_Script({ subsets: ["latin"], variable: "--font-sig-dancing", display: "swap" })
const vibes = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-sig-vibes", display: "swap" })
const caveat = Caveat({ subsets: ["latin"], variable: "--font-sig-caveat", display: "swap" })
const allura = Allura({ subsets: ["latin"], weight: "400", variable: "--font-sig-allura", display: "swap" })

export const signatureFontVars = [dancing.variable, vibes.variable, caveat.variable, allura.variable].join(" ")
