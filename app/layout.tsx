import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { themeScript } from "@/lib/theme"
import { uiFontVars } from "@/lib/ui-fonts"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const title = "PrettyBills — Free GST Invoice Maker with Beautiful Templates"
const description =
  "Make a GST-ready invoice in 30 seconds, share it on WhatsApp and get paid by UPI. Track payments, receipts, quotes and credit notes in one place. Free to start, no signup needed."

export const metadata: Metadata = {
  // PLACEHOLDER: production origin, used to build absolute Open Graph URLs.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://prettybill.in"),
  title,
  description,
  applicationName: "PrettyBills",
  keywords: ["GST invoice", "invoice maker", "free invoice generator", "UPI QR invoice", "invoice templates India"],
  openGraph: {
    type: "website",
    siteName: "PrettyBills",
    title,
    description,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title, description },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} ${uiFontVars} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans font-medium">{children}</body>
    </html>
  )
}
