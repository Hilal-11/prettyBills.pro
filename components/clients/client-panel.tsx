"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  BadgeCheckIcon,
  BanknoteIcon,
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  FilePlus2Icon,
  GlobeIcon,
  HashIcon,
  HourglassIcon,
  IdCardIcon,
  LandmarkIcon,
  MailIcon,
  MapPinIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  PhoneIcon,
  ReceiptTextIcon,
  TimerIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa6"
import { cn } from "cn"

import { ClientDialog } from "@/components/app/clients-manager"
import { useToast } from "@/components/invoice-editor/toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { TaxTreatment } from "@/lib/billing/client-profile"
import { formatDate } from "@/lib/billing/dates"
import { MODE_LABEL, type PaymentMode } from "@/lib/billing/modes"
import { deleteClientRemote } from "@/lib/client/workspace"
import type { Client } from "@/lib/invoice/defaults"
import { stateLabel } from "@/lib/invoice/config"
import { formatMoney } from "@/lib/invoice/totals"
import { spring } from "@/lib/motion"

export type PanelProfile = {
  firstInvoice: string | null
  lastInvoice: string | null
  lastPayment: string | null
  avgDaysToPay: number | null
  onTimeRate: number | null
  paidInvoices: number
  usualMode: PaymentMode | null
}

const money = (p: number) => formatMoney(p, { whole: true })
const monthYear = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })

/**
 * The left-hand panel on a client's page: who they are, how to reach them,
 * how GST applies, and how they pay, with every action one tap away
 * (invoice, email, WhatsApp, edit, statement, copy, remove).
 */
export function ClientPanel({
  client: c,
  balance,
  profile,
  tax,
  invoices,
  credit = 0,
}: {
  client: Client & { createdAt: string; updatedAt: string }
  balance: { outstanding: number; overdue: number; received: number; tds: number }
  /** Unapplied credit from issued credit notes. */
  credit?: number
  profile: PanelProfile
  tax: TaxTreatment | null
  invoices: number
}) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)
  const id = encodeURIComponent(c.id)
  const digits = (c.phone ?? "").replace(/\D/g, "")
  const wa = digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : null
  const state = c.gstin?.slice(0, 2) || c.address.stateCode
  const address = [c.address.line1, c.address.line2, [c.address.city, c.address.pin].filter(Boolean).join(" ")].filter(Boolean)

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text).catch(() => {})
    toast({ title: `${what} copied`, description: text, tone: "success", duration: 2000 })
  }

  const status = balance.overdue > 0 ? { label: `${money(balance.overdue)} overdue`, cls: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400" } : balance.outstanding > 0 ? { label: `Owes ${money(balance.outstanding)}`, cls: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300" } : invoices ? { label: "All settled", cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" } : { label: "Not billed yet", cls: "bg-muted text-muted-foreground" }

  return (
    <div className="grid">
      {/* identity */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="grid gap-3 border-b p-5">
        <ClientAvatar name={c.name} />
        <div className="grid gap-0.5">
          <h1 className="text-lg leading-tight font-semibold tracking-[-0.02em]">{c.name}</h1>
          <p className="truncate text-[13px] text-muted-foreground">{c.legalName && c.legalName !== c.name ? c.legalName : c.website ? c.website.replace(/^https?:\/\//, "") : profile.firstInvoice ? `Client since ${monthYear(profile.firstInvoice)}` : `Added ${monthYear(c.createdAt)}`}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium", status.cls)}>{status.label}</span>
          <span className="inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] text-muted-foreground">
            {c.gstin ? <BadgeCheckIcon className="size-3 text-brand dark:text-[#6da2ff]" /> : null}
            {c.gstin ? "GST registered" : "Unregistered"}
          </span>
          {tax && <span className="inline-flex h-5 items-center rounded-full border px-2 text-[11px] text-muted-foreground">{tax.detail}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href={`/create?client=${id}`} className={cn(buttonVariants({ variant: "outline" }), act)}>
            <FilePlus2Icon /> Invoice
          </Link>
          {c.email && (
            <a href={`mailto:${c.email}`} className={cn(buttonVariants({ variant: "outline" }), act)}>
              <MailIcon /> Email
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline" }), act)}>
              <FaWhatsapp className="text-emerald-600 dark:text-emerald-400" /> WhatsApp
            </a>
          )}
          <Button variant="outline" className={act} onClick={() => setEditing(true)}>
            <PencilLineIcon /> Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="More actions" className="size-7" />}>
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48 rounded-xl p-1.5">
              <DropdownMenuItem className={item} render={<Link href={`/clients/${id}?tab=statement`} />}>
                <ReceiptTextIcon /> Statement of account
              </DropdownMenuItem>
              <DropdownMenuItem className={item} render={<a href={`/api/clients/${id}/statement?period=this_fy&format=pdf`} download />}>
                <ReceiptTextIcon /> Download statement (PDF)
              </DropdownMenuItem>
              {c.gstin && (
                <DropdownMenuItem className={item} onClick={() => copy(c.gstin!, "GSTIN")}>
                  <CopyIcon /> Copy GSTIN
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className={item} onClick={() => copy([c.name, ...address, c.address.stateCode && stateLabel(c.address.stateCode), c.gstin && `GSTIN ${c.gstin}`].filter(Boolean).join("\n"), "Billing details")}>
                <CopyIcon /> Copy billing details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className={item} onClick={() => setRemoving(true)}>
                <Trash2Icon /> Remove client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* details */}
      <Section title="Details">
        <Field icon={BuildingIcon} label="Legal name" value={c.legalName || c.name} />
        <Field icon={HashIcon} label="GSTIN" value={c.gstin} mono onCopy={c.gstin ? () => copy(c.gstin!, "GSTIN") : undefined} empty="Unregistered" />
        <Field icon={IdCardIcon} label="PAN" value={c.pan} mono onCopy={c.pan ? () => copy(c.pan!, "PAN") : undefined} />
        <Field icon={MailIcon} label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} onCopy={c.email ? () => copy(c.email!, "Email") : undefined} />
        <Field icon={PhoneIcon} label="Phone" value={c.phone} href={c.phone ? `tel:${c.phone.replace(/\s/g, "")}` : undefined} onCopy={c.phone ? () => copy(c.phone!, "Phone") : undefined} />
        <Field icon={GlobeIcon} label="Website" value={c.website?.replace(/^https?:\/\//, "")} href={c.website ? (/^https?:/.test(c.website) ? c.website : `https://${c.website}`) : undefined} external />
        <Field icon={MapPinIcon} label="Address" value={address.length ? address.join("\n") : undefined} multiline />
        <Field icon={LandmarkIcon} label="Place of supply" value={state ? stateLabel(state) : c.address.country !== "India" ? c.address.country : undefined} />
        {tax && <Field icon={ReceiptTextIcon} label="Tax" value={`${tax.label} · ${tax.detail}`} />}
      </Section>

      <Section title="How they pay">
        <Field icon={TimerIcon} label="Days to pay" value={profile.avgDaysToPay !== null ? `${profile.avgDaysToPay} days on average` : undefined} empty="No paid invoices yet" />
        <Field icon={HourglassIcon} label="On time" value={profile.onTimeRate !== null ? `${profile.onTimeRate}% of ${profile.paidInvoices} paid` : undefined} meter={profile.onTimeRate} />
        <Field icon={BanknoteIcon} label="Usually by" value={profile.usualMode ? MODE_LABEL[profile.usualMode] : undefined} />
        <Field icon={CheckIcon} label="Received" value={balance.received ? money(balance.received) : undefined} empty="Nothing yet" />
        {balance.tds > 0 && <Field icon={ReceiptTextIcon} label="TDS deducted" value={money(balance.tds)} />}
        {credit > 0 && <Field icon={BanknoteIcon} label="Available credit" value={money(credit)} href={`/credit-notes?status=unapplied&client=${id}`} />}
      </Section>

      <Section title="History">
        <Field icon={CalendarIcon} label="First invoice" value={profile.firstInvoice ? formatDate(profile.firstInvoice) : undefined} empty="None yet" />
        <Field icon={CalendarIcon} label="Last invoice" value={profile.lastInvoice ? formatDate(profile.lastInvoice) : undefined} empty="None yet" />
        <Field icon={CalendarIcon} label="Last payment" value={profile.lastPayment ? formatDate(profile.lastPayment) : undefined} empty="None yet" />
        <Field icon={CalendarIcon} label="Added" value={formatDate(c.createdAt.slice(0, 10))} />
      </Section>

      <ClientDialog
        client={editing ? c : null}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false)
          toast({ title: `${saved.name} updated`, tone: "success", duration: 2500 })
          router.refresh()
        }}
      />
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {c.name}?</AlertDialogTitle>
            <AlertDialogDescription>They won&apos;t be in your client list any more. {invoices ? `Their ${invoices} invoice${invoices === 1 ? "" : "s"} keep the details they were sent with.` : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-8 text-[13px]"
              onClick={async () => {
                setRemoving(false)
                try {
                  await deleteClientRemote(c.id)
                  toast({ title: `${c.name} removed`, tone: "success", duration: 2500 })
                  router.push("/clients")
                } catch (e) {
                  toast({ title: (e as Error).message, tone: "error" })
                }
              }}
            >
              Remove client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const act = "h-7 gap-1.5 px-2.5 text-xs"
const item = "gap-2 py-1.5 text-[13px]"

/** A larger version of the table's client chip, with initials. */
function ClientAvatar({ name }: { name: string }) {
  let h = 0
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const hue = h % 360
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
  return (
    <span
      aria-hidden
      className="grid size-12 place-items-center rounded-xl text-[15px] font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2),0_8px_20px_-10px_rgb(0_0_0/0.4)]"
      style={{ background: `linear-gradient(135deg, oklch(0.72 0.14 ${hue}), oklch(0.52 0.18 ${(hue + 50) % 360}))` }}
    >
      {initials}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-0.5 border-b px-3 py-3 last:border-b-0">
      <h2 className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Field({
  icon: Icon,
  label,
  value,
  href,
  external,
  mono,
  multiline,
  empty = "—",
  onCopy,
  meter,
}: {
  icon: LucideIcon
  label: string
  value?: string | null
  href?: string
  external?: boolean
  mono?: boolean
  multiline?: boolean
  empty?: string
  onCopy?: () => void
  meter?: number | null
}) {
  const body = value ? (
    href ? (
      <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined} className="truncate hover:underline">
        {value}
      </a>
    ) : (
      <span className={cn(multiline ? "whitespace-pre-line" : "truncate", mono && "font-mono text-[12px] tracking-tight")}>{value}</span>
    )
  ) : (
    <span className="text-muted-foreground/70">{empty}</span>
  )
  return (
    <div className="group/field flex min-h-8 items-start gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted/40">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="grid min-w-0 flex-1 gap-1 font-medium">
        {body}
        {meter != null && (
          <span className="block h-1 overflow-hidden rounded-full bg-muted">
            <motion.span initial={{ width: 0 }} animate={{ width: `${meter}%` }} transition={spring} className={cn("block h-full rounded-full", meter >= 80 ? "bg-emerald-500" : meter >= 50 ? "bg-amber-500" : "bg-red-500")} />
          </span>
        )}
      </span>
      {onCopy && (
        <button type="button" aria-label={`Copy ${label}`} onClick={onCopy} className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/field:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100">
          <CopyIcon className="size-3" />
        </button>
      )}
    </div>
  )
}
