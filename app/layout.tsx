import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { themeScript } from "@/lib/theme"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const title = "Prettybill — Free GST Invoice Maker with Beautiful Templates"
const description =
  "Make a GST-ready invoice in 30 seconds. Pick a template, add your items, share on WhatsApp and get paid by UPI. Free forever, no signup needed."

export const metadata: Metadata = {
  // PLACEHOLDER: production origin, used to build absolute Open Graph URLs.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://prettybill.in"),
  title,
  description,
  applicationName: "Prettybill",
  keywords: ["GST invoice", "invoice maker", "free invoice generator", "UPI QR invoice", "invoice templates India"],
  openGraph: {
    type: "website",
    siteName: "Prettybill",
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
    <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
