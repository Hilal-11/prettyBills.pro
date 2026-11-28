export const THEME_STORAGE_KEY = "prettybill-theme"
export const FONT_STORAGE_KEY = "prettybill-font"

/** Interface fonts people can pick. `geist` is the default (no attribute set). CSS: globals.css, html[data-font]. */
export const UI_FONTS = [
  { id: "geist", label: "Geist", kind: "Sans serif", family: "var(--font-geist-sans)" },
  { id: "inter", label: "Inter", kind: "Sans serif", family: "var(--font-inter)" },
  { id: "plex", label: "IBM Plex Sans", kind: "Sans serif", family: "var(--font-plex)" },
  { id: "manrope", label: "Manrope", kind: "Sans serif", family: "var(--font-manrope)" },
  { id: "source-serif", label: "Source Serif 4", kind: "Serif", family: "var(--font-source-serif)" },
  { id: "literata", label: "Literata", kind: "Serif", family: "var(--font-literata)" },
  { id: "geist-mono", label: "Geist Mono", kind: "Mono", family: "var(--font-geist-mono)" },
  { id: "jetbrains", label: "JetBrains Mono", kind: "Mono", family: "var(--font-jetbrains)" },
] as const
export type UiFont = (typeof UI_FONTS)[number]["id"]
export const isUiFont = (v: unknown): v is UiFont => UI_FONTS.some((f) => f.id === v)

/**
 * Inlined in <head> so it runs before first paint: applies the saved theme
 * (otherwise the OS preference) and the chosen interface font. No flash of
 * the wrong theme or font.
 */
export const themeScript = `(function(){try{var e=document.documentElement;var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;e.classList.toggle("dark",d);var f=localStorage.getItem("${FONT_STORAGE_KEY}");if(f&&f!=="geist"&&/^[a-z-]{2,20}$/.test(f))e.setAttribute("data-font",f)}catch(x){}})()`
