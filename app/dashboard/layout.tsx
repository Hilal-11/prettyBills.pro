import type { ReactNode } from "react"
import type { Metadata } from "next"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

export const metadata: Metadata = {
  title: "Dashboard · Prettybill",
  robots: { index: false },
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delay={300}>
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar />
        <SidebarInset className="min-h-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)]">{children}</SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
