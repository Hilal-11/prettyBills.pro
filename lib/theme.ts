export const THEME_STORAGE_KEY = "prettybill-theme"

/**
 * Inlined in <head> so it runs before first paint: applies the saved theme,
 * otherwise the OS preference. No flash of the wrong theme.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`
