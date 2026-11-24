import { AnalyticsListener } from "@/components/landing/analytics-listener"
import { Footer } from "@/components/landing/footer"
import { Hero } from "@/components/landing/hero"
import { Navbar } from "@/components/landing/navbar"

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
      </main>
      <Footer />
      <AnalyticsListener />
    </>
  )
}
