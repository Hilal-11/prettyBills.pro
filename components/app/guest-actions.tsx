"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FilePlus2Icon, LogInIcon } from "lucide-react"
import { cn } from "cn"

import { Button, buttonVariants } from "@/components/ui/button"
import { authHref } from "@/lib/client/handoff"

/** Log in / start an invoice, for guests on pages that show saved work. */
export function GuestActions() {
  const router = useRouter()
  const [going, setGoing] = React.useState(false)
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      <Button
        className="h-8 gap-1.5 px-3 text-[13px]"
        disabled={going}
        onClick={() => {
          setGoing(true)
          router.push(authHref("login", window.location.pathname))
        }}
      >
        <LogInIcon /> {going ? "Opening…" : "Log in to see your work"}
      </Button>
      <Link href="/create" className={cn(buttonVariants({ variant: "outline" }), "h-8 gap-1.5 px-3 text-[13px]")}>
        <FilePlus2Icon /> Make an invoice
      </Link>
    </div>
  )
}
