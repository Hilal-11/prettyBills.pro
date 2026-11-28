import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { buildDashboard, type DashboardCharts } from "@/lib/billing/dashboard"
import { addDays, dateIST } from "@/lib/billing/dates"
import { weeklySeries } from "@/lib/billing/invoice-query"
import { formatINR } from "@/lib/billing/money"
import { isMode, MODE_LABEL, type PaymentMode } from "@/lib/billing/modes"
import type { InvoiceEvent, InvoiceSummary, Overview } from "@/lib/data/types"

import { overviewOf, toSummary, type Activity, type InvoiceInsights, type SummaryRow } from "./invoices"
import { DbError, today } from "./util"

export type DashboardData = {
  today: string
  overview: Overview
  insights: InvoiceInsights
  charts: DashboardCharts
  overdue: InvoiceSummary[]
  upcoming: InvoiceSummary[]
  recent: InvoiceSummary[]
  activity: Activity[]
  /** Unapplied credit from issued credit notes, across clients. */
  clientCredit: number
  /** Sent quotes and proformas still waiting for an answer (and not expired). */
  quotesAwaiting: number
}

export type Raw = {
  overview: unknown
  invoices: SummaryRow[]
  payments: { invoice_id: string; amount_paise: number; paid_on: string; mode: PaymentMode }[]
  events: { type: InvoiceEvent["type"]; at: string; invoice_id: string; number: string; client_name: string | null }[]
  pay_events: { id: string; action: string; invoice_id: string | null; data: Record<string, unknown>; created_at: string }[]
  client_credit: number
  quotes_awaiting: number
}

/**
 * Everything the dashboard's cards can show, from one database call
 * (dashboard_data: overview, every invoice's list columns, a year of
 * payments, both activity feeds, client credit, quotes awaiting). The chart
 * series, lists and sparklines are built here from those rows.
 */
export async function dashboardData(db: SupabaseClient): Promise<DashboardData> {
  const on = today()
  const { data, error } = await db.rpc("dashboard_data", { p_today: on })
  if (error) throw new DbError(error)
  if (!data) throw new Error("Your session has ended. Log in again.")
  return buildDashboardData(data as Raw, on)
}

/** The cards' data from dashboard_data's JSON. Pure: shared by the request path and the server cache. */
export function buildDashboardData(raw: Raw, on: string): DashboardData {
  const invoices = raw.invoices.map((r) => toSummary(r, on))
  const payments = raw.payments.map((p) => ({ invoiceId: p.invoice_id, amount: Number(p.amount_paise), paidOn: p.paid_on, mode: p.mode }))

  const charts = buildDashboard(
    invoices.map((i) => ({ ...i, paidOn: i.paidAt ? dateIST(i.paidAt) : null })),
    payments.map((p) => ({ amount: p.amount, paidOn: p.paidOn, mode: p.mode })),
    on
  )

  // the KPI sparklines: invoices unpaid at some point in the last 12 weeks, and the payments since
  const start = addDays(on, -7 * 12)
  const insights: InvoiceInsights = {
    ...weeklySeries(
      invoices
        .filter((i) => ["sent", "viewed", "partially_paid", "paid"].includes(i.status) && (i.status !== "paid" || (i.paidAt ?? "") >= start))
        .map((i) => ({ id: i.id, total: i.total, amountPaid: i.amountPaid, balanceDue: i.balanceDue, issueDate: i.issueDate, dueDate: i.dueDate, status: i.status })),
      payments.filter((p) => p.paidOn >= start),
      on
    ),
    voided: invoices.filter((i) => i.status === "void").length,
  }

  const open = invoices.filter((i) => i.bucket === "sent" && i.balanceDue > 0 && i.daysPastDue !== null && i.daysPastDue >= -14)
  const activity: Activity[] = [
    ...raw.events.filter((a) => a.type !== "paid").map((e) => ({ type: e.type, at: e.at, invoiceId: e.invoice_id, number: e.number ?? "", clientName: e.client_name ?? "" })),
    ...raw.pay_events.map((p) => ({
      type: (p.action === "payment.deleted" ? "payment_deleted" : "payment") as Activity["type"],
      at: p.created_at,
      invoiceId: p.invoice_id ?? "",
      number: String(p.data.invoice_number ?? ""),
      clientName: "",
      detail:
        p.action === "payment.deleted"
          ? `payment of ${formatINR(Number(p.data.amount_paise ?? 0))} deleted`
          : `${formatINR(Number(p.data.amount_paise ?? 0))} received${isMode(p.data.mode) ? ` via ${MODE_LABEL[p.data.mode]}` : ""}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10)

  return {
    today: on,
    overview: overviewOf(raw.overview),
    insights,
    charts,
    overdue: invoices.filter((i) => i.bucket === "overdue").sort((a, b) => (b.daysPastDue ?? 0) - (a.daysPastDue ?? 0)).slice(0, 8),
    upcoming: open.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")).slice(0, 8),
    recent: [...invoices].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
    activity,
    clientCredit: Number(raw.client_credit ?? 0),
    quotesAwaiting: Number(raw.quotes_awaiting ?? 0),
  }
}
