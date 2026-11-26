import { BanknoteIcon, CircleEllipsisIcon, CreditCardIcon, LandmarkIcon, ScrollTextIcon, SmartphoneIcon } from "lucide-react"

import type { PaymentMode } from "@/lib/billing/modes"

const ICONS = { upi: SmartphoneIcon, cash: BanknoteIcon, bank_transfer: LandmarkIcon, cheque: ScrollTextIcon, card: CreditCardIcon, other: CircleEllipsisIcon } as const

export function ModeIcon({ mode, className }: { mode: PaymentMode; className?: string }) {
  const Icon = ICONS[mode] ?? CircleEllipsisIcon
  return <Icon aria-hidden className={className} />
}
