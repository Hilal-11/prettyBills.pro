import { Suspense, type ReactNode } from "react"
import type { Metadata } from "next"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardUIProvider } from "@/components/dashboard/dashboard-ui"
import { NavUserSkeleton } from "@/components/dashboard/nav-user"
import { SidebarUpgrade } from "@/components/dashboard/sidebar-upgrade"
import { SidebarUser } from "@/components/dashboard/sidebar-user"
import { ToastProvider } from "@/components/invoice-editor/toast"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { signatureFontVars } from "@/lib/fonts"

export const metadata: Metadata = {
  title: { template: "%s · PrettyBills", default: "PrettyBills" },
  robots: { index: false },
}

/**
 * The app: dashboard, editor, invoices, clients, items and templates share
 * this sidebar. Open to everyone; guests work in memory, signed-in users'
 * work is saved. The session read streams in behind Suspense so the shell
 * stays instant.
 * Settings, shortcuts, what's new and feedback open as dialogs over the editor.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delay={300}>
      <ToastProvider>
        <DashboardUIProvider>
          <SidebarProvider className={`h-svh overflow-hidden ${signatureFontVars}`}>
            <AppSidebar
              user={
                <Suspense fallback={<NavUserSkeleton />}>
                  <SidebarUser />
                </Suspense>
              }
              upgrade={
                <Suspense>
                  <SidebarUpgrade />
                </Suspense>
              }
            />
            <SidebarInset className="min-h-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)]">{children}</SidebarInset>
          </SidebarProvider>
        </DashboardUIProvider>
      </ToastProvider>
    </TooltipProvider>
  )
}
