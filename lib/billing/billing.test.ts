// Run with: npm test
import { test } from "node:test"
import assert from "node:assert/strict"

import { createHmac } from "node:crypto"

import { BOM, csvAmount, csvCell, csvRow } from "./csv.ts"
import { boardFromPreset, DEFAULT_BOARDS, parseBoards, serializeBoards } from "../dashboard/boards.ts"
import { computeInvoiceTotals } from "../invoice/totals.ts"
import { clientProfile, taxTreatment } from "./client-profile.ts"
import { buildCreditNote, creditableLines, fullRemaining, gstDeadline, invoiceRates, isLateForGst } from "./credit-notes.ts"
import { buildDashboard, lastMonths, monthLabel } from "./dashboard.ts"
import { fyQuarter, rateLabel, splitWithTds, TDS_SECTIONS, tdsBase, tdsLabel, tdsOnSettlement, tdsReport } from "./tds.ts"
import { calculate, hasFilters, invoiceQueryString, paiseToRupees, parseInvoiceQuery, rupeesToPaise, weeklySeries } from "./invoice-query.ts"
import { fromUnix, razorpayProblems, verifyCheckoutSignature, verifyWebhookSignature } from "./razorpay.ts"
import { parseFilters, filtersQuery } from "./filters.ts"
import { addDays, daysBetween, formatDate, fyLabel, fyRange, isISODate, presetRange, todayIST } from "./dates.ts"
import { billingCodeOf, billingMessage } from "./errors.ts"
import { buildStatement, receiptBalance, STATEMENT_KIND } from "./ledger.ts"
import { referenceHint, referenceLabel } from "./modes.ts"
import { amountInWordsINR, formatINR, paiseToInput, percentOf, toPaise } from "./money.ts"
import { getDisplayStatus } from "./status.ts"
import { checkConversion, conversionDocument, daysLeft, defaultMeta, displayStatus, DISPLAY_ORDER, footnote, quoteEmailSubject, quoteLabel, quoteWhatsappText, remainingLines, termDays, validityPreset, validityTone, validUntilFrom } from "./quotes.ts"
import { paymentDelete, paymentInput } from "./validation.ts"

test("toPaise accepts what people type", () => {
  assert.equal(toPaise("24575"), 2457500)
  assert.equal(toPaise("24,575"), 2457500)
  assert.equal(toPaise("24575.5"), 2457550)
  assert.equal(toPaise("24,575.50"), 2457550)
  assert.equal(toPaise("1,00,000"), 10000000)
  assert.equal(toPaise("1,00,00,000.01"), 1000000001)
  assert.equal(toPaise("100,000"), 10000000)
  assert.equal(toPaise(" ₹ 99 "), 9900)
  assert.equal(toPaise("0.5"), 50)
  assert.equal(toPaise(".75"), 75)
  assert.equal(toPaise("10."), 1000)
})

test("toPaise rejects everything else", () => {
  for (const bad of ["24.575.5", "-1", "1e5", "", "  ", "abc", "1.234", "1,,000", ",100", "1,00,0", "Infinity", "NaN", "0x10"]) {
    assert.equal(toPaise(bad), null, bad)
  }
})

test("formatINR uses Indian grouping", () => {
  assert.equal(formatINR(2457550), "₹24,575.50")
  assert.equal(formatINR(10000000), "₹1,00,000.00")
  assert.equal(formatINR(1000000000), "₹1,00,00,000.00")
  assert.equal(formatINR(12457500, { decimals: false }), "₹1,24,575")
  assert.equal(formatINR(0), "₹0.00")
  assert.equal(formatINR(-150), "−₹1.50")
  assert.equal(paiseToInput(2457550), "24575.50")
  assert.equal(paiseToInput(2457500), "24575")
  assert.equal(percentOf(1457501, 50), 728750)
})

test("amountInWordsINR", () => {
  assert.equal(amountInWordsINR(0), "Rupees Zero Only")
  assert.equal(amountInWordsINR(100), "Rupees One Only")
  assert.equal(amountInWordsINR(1100), "Rupees Eleven Only")
  assert.equal(amountInWordsINR(9900), "Rupees Ninety-Nine Only")
  assert.equal(amountInWordsINR(10000), "Rupees One Hundred Only")
  assert.equal(amountInWordsINR(100000), "Rupees One Thousand Only")
  assert.equal(amountInWordsINR(10000000), "Rupees One Lakh Only")
  assert.equal(amountInWordsINR(1000000000), "Rupees One Crore Only")
  assert.equal(amountInWordsINR(2457550), "Rupees Twenty-Four Thousand Five Hundred Seventy-Five and Fifty Paise Only")
})

test("financial year boundaries", () => {
  assert.equal(fyLabel("2026-11-25"), "26-27")
  assert.equal(fyLabel("2027-02-10"), "26-27")
  assert.equal(fyLabel("2027-03-31"), "26-27")
  assert.equal(fyLabel("2027-04-01"), "27-28")
  assert.equal(fyLabel("2099-04-01"), "99-00")
  assert.deepEqual(fyRange("2027-01-05"), { from: "2026-04-01", to: "2027-03-31" })
})

test("today is the India date, not the UTC one", () => {
  // 23:59 IST on 31 Mar is 18:29 UTC: both say March
  assert.equal(todayIST(new Date("2027-03-31T18:29:00Z")), "2027-03-31")
  // 1 Apr 00:10 IST is 31 Mar 18:40 UTC: UTC says March, India says April (new FY)
  const justAfterMidnight = new Date("2027-03-31T18:40:00Z")
  assert.equal(justAfterMidnight.toISOString().slice(0, 10), "2027-03-31")
  assert.equal(todayIST(justAfterMidnight), "2027-04-01")
  assert.equal(fyLabel(todayIST(justAfterMidnight)), "27-28")
})

test("dates", () => {
  assert.equal(formatDate("2026-11-25"), "25 Nov 2026")
  assert.equal(formatDate("2026-11-05T10:00:00Z"), "05 Nov 2026")
  assert.equal(formatDate(null), "—")
  assert.equal(daysBetween("2026-11-01", "2026-11-25"), 24)
  assert.equal(addDays("2026-02-28", 1), "2026-03-01")
  assert.equal(isISODate("2026-02-30"), false)
  assert.equal(isISODate("2026-02-28"), true)
  assert.deepEqual(presetRange("last_month", "2026-03-15"), { from: "2026-02-01", to: "2026-02-28" })
  assert.deepEqual(presetRange("this_week", "2026-11-25"), { from: "2026-11-23", to: "2026-11-25" }) // Wednesday → Monday
  assert.deepEqual(presetRange("last_fy", "2026-11-25"), { from: "2025-04-01", to: "2026-03-31" })
  assert.deepEqual(presetRange("this_fy", "2027-01-10"), { from: "2026-04-01", to: "2027-01-10" })
})

test("display status follows the table, in order", () => {
  const today = "2026-11-25"
  const base = { total: 10000, amountPaid: 0, dueDate: "2026-12-01", viewedAt: null }
  assert.deepEqual(getDisplayStatus({ ...base, status: "void", amountPaid: 10000 }, today), { status: "void" })
  assert.deepEqual(getDisplayStatus({ ...base, status: "draft", dueDate: "2020-01-01" }, today), { status: "draft" })
  assert.deepEqual(getDisplayStatus({ ...base, status: "paid", amountPaid: 10000, dueDate: "2020-01-01" }, today), { status: "paid" })
  assert.deepEqual(getDisplayStatus({ ...base, status: "sent", dueDate: "2026-11-24" }, today), { status: "overdue" })
  assert.deepEqual(getDisplayStatus({ ...base, status: "partially_paid", amountPaid: 4000, dueDate: "2026-11-24" }, today), { status: "overdue", secondary: "partially_paid" })
  assert.deepEqual(getDisplayStatus({ ...base, status: "partially_paid", amountPaid: 4000 }, today), { status: "partially_paid" })
  assert.deepEqual(getDisplayStatus({ ...base, status: "viewed", viewedAt: "2026-11-20T10:00:00Z" }, today), { status: "viewed" })
  assert.deepEqual(getDisplayStatus({ ...base, status: "sent" }, today), { status: "sent" })
  // due today is not overdue
  assert.deepEqual(getDisplayStatus({ ...base, status: "sent", dueDate: today }, today), { status: "sent" })
})

test("receipt balance uses payment order and ignores later edits", () => {
  const pays = [
    { id: "b", paidOn: "2026-11-20", createdAt: "2026-11-20T10:00:00Z", amount: 5000 },
    { id: "a", paidOn: "2026-11-10", createdAt: "2026-11-21T10:00:00Z", amount: 3000 },
    { id: "c", paidOn: "2026-11-20", createdAt: "2026-11-20T09:00:00Z", amount: 2000 },
  ]
  assert.deepEqual(receiptBalance(pays, "b", 10000), { total: 10000, paidBefore: 5000, thisPayment: 5000, remaining: 0, paidInFull: true })
  assert.deepEqual(receiptBalance(pays, "a", 12000), { total: 12000, paidBefore: 0, thisPayment: 3000, remaining: 9000, paidInFull: false })
})

test("statement: opening, ordering, running balance, closing", () => {
  const s = buildStatement({
    from: "2026-11-01",
    to: "2026-11-30",
    invoices: [
      { id: "i0", number: "INV/001", issueDate: "2026-10-05", total: 10000, createdAt: "2026-10-05T00:00:00Z" },
      { id: "i1", number: "INV/002", issueDate: "2026-11-10", total: 20000, createdAt: "2026-11-10T00:00:00Z" },
      { id: "i2", number: "INV/003", issueDate: "2026-12-01", total: 99999, createdAt: "2026-12-01T00:00:00Z" },
    ],
    payments: [
      { id: "p0", invoiceId: "i0", invoiceNumber: "INV/001", paidOn: "2026-10-20", amount: 4000, mode: "upi", createdAt: "2026-10-20T00:00:00Z" },
      { id: "p1", invoiceId: "i1", invoiceNumber: "INV/002", paidOn: "2026-11-10", amount: 5000, mode: "cash", createdAt: "2026-11-10T00:00:00Z", receiptNumber: "RCPT/26-27/002" },
      { id: "p2", invoiceId: "i0", invoiceNumber: "INV/001", paidOn: "2026-11-15", amount: 6000, mode: "upi", reference: "512345678901", createdAt: "2026-11-15T00:00:00Z" },
    ],
  })
  assert.equal(s.opening, 6000)
  assert.deepEqual(s.rows.map((r) => [r.kind, r.id, r.balance]), [["invoice", "i1", 26000], ["payment", "p1", 21000], ["payment", "p2", 15000]])
  assert.equal(s.invoiced, 20000)
  assert.equal(s.received, 11000)
  assert.equal(s.closing, s.opening + s.invoiced - s.received)
})

test("CSV: quoting, injection, amounts", () => {
  assert.equal(csvCell("plain"), "plain")
  assert.equal(csvCell('He said "hi", then left'), '"He said ""hi"", then left"')
  assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"")
  assert.equal(csvCell("+91 98765"), "'+91 98765")
  assert.equal(csvCell("-5"), "'-5")
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)")
  assert.equal(csvCell("\tx"), "'\tx")
  assert.equal(csvCell(null), "")
  assert.equal(csvCell("राहुल ₹"), "राहुल ₹")
  assert.equal(csvRow(["a", 1, null]), "a,1,\r\n")
  assert.equal(csvAmount(1457500), "14575.00")
  assert.equal(csvAmount(5), "0.05")
  assert.equal(BOM.charCodeAt(0), 0xfeff)
})

test("payment input validation", () => {
  const ok = paymentInput.safeParse({ invoiceId: "inv_1", amountPaise: 100, paidOn: "2026-11-25", mode: "upi", reference: "  ", note: "", idempotencyKey: "0b8f3f5e-3a5e-4f6e-9b9f-6f2c2c9a1d10" })
  assert.equal(ok.success, true)
  assert.equal(ok.success && ok.data.reference, undefined)
  assert.equal(paymentInput.safeParse({ invoiceId: "inv_1", amountPaise: 1.5, paidOn: "2026-11-25", mode: "upi", idempotencyKey: "0b8f3f5e-3a5e-4f6e-9b9f-6f2c2c9a1d10" }).success, false)
  assert.equal(paymentInput.safeParse({ invoiceId: "inv_1", amountPaise: 100, paidOn: "2026-02-30", mode: "upi", idempotencyKey: "0b8f3f5e-3a5e-4f6e-9b9f-6f2c2c9a1d10" }).success, false)
  assert.equal(paymentInput.safeParse({ invoiceId: "inv_1", amountPaise: 100, paidOn: "2026-11-25", mode: "bitcoin", idempotencyKey: "0b8f3f5e-3a5e-4f6e-9b9f-6f2c2c9a1d10" }).success, false)
  assert.equal(paymentDelete.safeParse({ paymentId: "0b8f3f5e-3a5e-4f6e-9b9f-6f2c2c9a1d10", reason: "ok" }).success, false)
})

test("reference hints never block, and fit the mode", () => {
  assert.equal(referenceHint("upi", "512345678901"), null)
  assert.match(referenceHint("upi", "123") ?? "", /12 digits/)
  assert.equal(referenceHint("cheque", "000123"), null)
  assert.match(referenceHint("bank_transfer", "") ?? "", /Recommended/)
  assert.equal(referenceHint("cash", ""), null)
  assert.equal(referenceLabel("cheque"), "Cheque no.")
  assert.equal(referenceLabel("cash"), null)
})

test("error messages", () => {
  assert.equal(billingMessage("OVERPAYMENT", "1457500"), "Received + TDS is more than the balance due (₹14,575.00). Settle ₹14,575.00 or less.")
  assert.equal(billingCodeOf({ code: "P0001", message: "FUTURE_DATE" }), "FUTURE_DATE")
  assert.equal(billingCodeOf({ code: "23505", message: "dup" }), null)
  assert.match(billingMessage("WHATEVER"), /not saved/)
})

test("filters round-trip through the URL", () => {
  const f = parseFilters(new URLSearchParams("range=last_month&client=c1,c2,bad%20id&mode=upi,bitcoin,cash&q=%20utr%20"), "2026-11-25")
  assert.deepEqual([f.preset, f.from, f.to], ["last_month", "2026-10-01", "2026-10-31"])
  assert.deepEqual(f.clients, ["c1", "c2"])
  assert.deepEqual(f.modes, ["upi", "cash"])
  assert.equal(f.q, "utr")
  assert.equal(filtersQuery(f), "range=last_month&client=c1%2Cc2&mode=upi%2Ccash&q=utr")
  const c = parseFilters({ from: "2026-11-01", to: "2026-11-15", range: "this_fy" }, "2026-11-25")
  assert.deepEqual([c.preset, c.from, c.to], ["custom", "2026-11-01", "2026-11-15"])
  assert.equal(parseFilters({}, "2026-11-25").preset, "this_month")
  assert.deepEqual(presetRange("last_30", "2026-11-25"), { from: "2026-10-27", to: "2026-11-25" })
})

test("razorpay: checkout and webhook signatures", () => {
  const secret = "test_secret_123"
  const sig = createHmac("sha256", secret).update("pay_1|sub_1").digest("hex")
  assert.equal(verifyCheckoutSignature({ paymentId: "pay_1", subscriptionId: "sub_1", signature: sig }, secret), true)
  assert.equal(verifyCheckoutSignature({ paymentId: "pay_2", subscriptionId: "sub_1", signature: sig }, secret), false)
  assert.equal(verifyCheckoutSignature({ paymentId: "pay_1", subscriptionId: "sub_1", signature: sig }, "other"), false)
  assert.equal(verifyCheckoutSignature({ paymentId: "pay_1", subscriptionId: "sub_1", signature: "" }, secret), false)
  const body = '{"event":"subscription.charged"}'
  const wsig = createHmac("sha256", "whsec").update(body).digest("hex")
  assert.equal(verifyWebhookSignature(body, wsig, "whsec"), true)
  assert.equal(verifyWebhookSignature(body + " ", wsig, "whsec"), false)
  assert.equal(verifyWebhookSignature(body, null, "whsec"), false)
  assert.equal(verifyWebhookSignature(body, wsig, ""), false)
  assert.equal(fromUnix(1764028800), "2025-11-25T00:00:00.000Z")
  assert.equal(fromUnix(null), null)
})

test("razorpay: config mix-ups are caught", () => {
  const ok = { keyId: "rzp_test_abc", keySecret: "s3cr3tValue", planMonthly: "plan_A", planYearly: "plan_B", webhookSecret: "w", serviceRoleKey: "k" }
  assert.deepEqual(razorpayProblems(ok, { plan: "monthly", webhook: true }), [])
  assert.match(razorpayProblems({ ...ok, keySecret: ok.keyId }, { plan: "monthly" }).join(), /key id, not the secret/)
  assert.match(razorpayProblems({ ...ok, planMonthly: "sub_X" }, { plan: "monthly" }).join(), /subscription id/)
  assert.match(razorpayProblems({ ...ok, planYearly: undefined }, { plan: "yearly" }).join(), /RAZORPAY_PLAN_ID_YEARLY is missing/)
  assert.deepEqual(razorpayProblems({ ...ok, planYearly: undefined }, { plan: "monthly" }), [])
})

test("invoice table: URL state round-trips and drops defaults", () => {
  const q = parseInvoiceQuery({ view: "overdue", q: " acme ", client: "c_1,bad id,c_2", min: "1,500", max: "100", range: "this_fy", page: "3" })
  assert.equal(q.view, "overdue")
  assert.equal(q.q, "acme")
  assert.deepEqual(q.clients, ["c_1", "c_2"])
  assert.equal(q.min, 10000) // swapped: min was above max
  assert.equal(q.max, 150000)
  assert.equal(q.sort, "due")
  assert.equal(q.dir, "asc")
  assert.equal(q.page, 3)
  assert.equal(invoiceQueryString(q, {}), "view=overdue&q=acme&client=c_1%2Cc_2&range=this_fy&min=100&max=1500")
  // switching tab resets the page and the tab's own default sort
  assert.equal(invoiceQueryString(q, { view: "all", q: "", clients: [], preset: "all", min: null, max: null }), "")
  assert.equal(invoiceQueryString(parseInvoiceQuery({}), { sort: "amount", dir: "desc" }), "sort=amount&dir=desc")
  assert.equal(parseInvoiceQuery({ view: "nope", page: "999", sort: "x" }).view, "all")
  assert.equal(parseInvoiceQuery({ page: "999" }).page, 10)
  assert.equal(parseInvoiceQuery({ from: "2026-04-01" }).preset, "custom")
  assert.equal(rupeesToPaise("₹1,49,999.5"), 14999950)
  assert.equal(rupeesToPaise("12.345"), null)
  assert.equal(paiseToRupees(1050), "10.5")
  assert.equal(hasFilters(parseInvoiceQuery({ view: "paid" })), false)
})

test("invoice table: weekly series rebuild past balances from payments", () => {
  const today = "2026-11-27"
  const invoices = [
    // issued 5 weeks ago, due 3 weeks ago, paid in full 1 week ago
    { id: "a", total: 10000, amountPaid: 10000, issueDate: "2026-10-23", dueDate: "2026-11-06", status: "paid", balanceDue: 0 },
    // still open, due in 10 days, half paid 2 days ago
    { id: "b", total: 5000, amountPaid: 2500, issueDate: "2026-11-20", dueDate: "2026-12-07", status: "partially_paid", balanceDue: 2500 },
  ]
  const payments = [
    { invoiceId: "a", amount: 10000, paidOn: "2026-11-20" },
    { invoiceId: "b", amount: 2500, paidOn: "2026-11-25" },
  ]
  const s = weeklySeries(invoices, payments, today, 6)
  // points: 10-23, 10-30, 11-06, 11-13, 11-20, 11-27
  assert.deepEqual(s.outstanding, [10000, 10000, 10000, 10000, 5000, 2500])
  assert.deepEqual(s.overdue, [0, 0, 0, 10000, 0, 0])
  assert.deepEqual(s.collected, [0, 0, 0, 0, 10000, 2500])
  assert.equal(s.dueSoonAmount, 2500)
  assert.equal(s.dueSoonCount, 1)
  assert.deepEqual(s.ahead, [0, 2500, 0, 0, 0, 0, 0, 0])
})

test("invoice table: footer calculations", () => {
  assert.equal(calculate("sum", [100, null, 250]), 350)
  assert.equal(calculate("avg", [100, 201]), 151)
  assert.equal(calculate("count", [1, null]), 2)
  assert.equal(calculate("filled", [1, null, ""]), 1)
  assert.equal(calculate("unique", ["A", "B", "A", null]), 2)
  assert.equal(calculate("earliest", ["2026-03-01", "2025-12-01", null]), "2025-12-01")
  assert.equal(calculate("latest", ["2026-03-01", "2025-12-01"]), "2026-03-01")
  assert.equal(calculate("min", []), null)
  assert.equal(calculate("none", [1]), null)
})

test("dashboard: months, ageing, status, clients, methods, days to pay", () => {
  assert.deepEqual(lastMonths("2026-02-10", 3), ["2025-12", "2026-01", "2026-02"])
  assert.equal(monthLabel("2026-01"), "Jan 26")
  assert.equal(monthLabel("2025-11"), "Nov")
  const base = { clientId: "c1", clientName: "Acme", amountPaid: 0, paidOn: null as string | null, dueDate: null as string | null }
  const d = buildDashboard(
    [
      { ...base, id: "1", status: "paid", bucket: "paid", total: 1000, amountPaid: 1000, balanceDue: 0, issueDate: "2026-10-01", paidOn: "2026-10-11" },
      { ...base, id: "2", status: "sent", bucket: "overdue", total: 500, balanceDue: 500, issueDate: "2026-09-01", dueDate: "2026-09-15" },
      { ...base, id: "3", clientId: "c2", clientName: "Beta", status: "partially_paid", bucket: "sent", total: 800, amountPaid: 300, balanceDue: 500, issueDate: "2026-11-20", dueDate: "2026-12-05" },
      { ...base, id: "4", status: "draft", bucket: "draft", total: 900, balanceDue: 900, issueDate: "2026-11-25" },
      { ...base, id: "5", status: "void", bucket: "void", total: 50, balanceDue: 0, issueDate: "2026-11-25" },
    ],
    [
      { amount: 1000, paidOn: "2026-10-11", mode: "upi" },
      { amount: 300, paidOn: "2026-11-21", mode: "cash" },
      { amount: 99, paidOn: "2024-01-01", mode: "card" }, // outside the window
    ],
    "2026-11-27"
  )
  assert.equal(d.monthly.length, 12)
  assert.deepEqual(d.monthly.at(-1), { key: "2026-11", label: "Nov", invoiced: 800, collected: 300, raised: 1 })
  assert.equal(d.monthly.at(-2)?.collected, 1000)
  assert.deepEqual(d.ageing.current, { amount: 500, count: 1 })
  assert.deepEqual(d.ageing.d90, { amount: 500, count: 1 }) // 73 days late
  assert.deepEqual(d.status.draft, { amount: 900, count: 1 })
  assert.deepEqual(d.status.overdue, { amount: 500, count: 1 })
  assert.equal(d.status.void.count, 1)
  assert.deepEqual(
    d.topClients.map((c) => [c.name, c.billed, c.outstanding, c.overdue]),
    [["Acme", 1500, 500, 500], ["Beta", 800, 500, 0]]
  )
  assert.deepEqual(d.methods.map((m) => m.mode), ["upi", "cash"])
  assert.equal(d.daysToPay.at(-2)?.days, 10)
  assert.equal(d.daysToPay.at(-1)?.days, null)
})

test("dashboard layouts: cookie round-trip and junk is dropped", () => {
  const b = { active: "x", boards: [{ id: "x", name: "Mine", cards: [{ id: "c1", type: "ageing" as const, size: "l" as const }] }] }
  assert.deepEqual(parseBoards(serializeBoards(b)), b)
  assert.deepEqual(parseBoards("not json"), DEFAULT_BOARDS)
  assert.deepEqual(parseBoards(undefined), DEFAULT_BOARDS)
  const junk = JSON.stringify({ a: "nope", b: [{ i: "y", n: "  ", c: [["ageing", "m", "k"], ["bogus", "s", "z"], ["status", "xl", "q"], ["status", "s", "k"]] }, { i: "bad id!", n: "x", c: [] }] })
  assert.deepEqual(parseBoards(junk), { active: "y", boards: [{ id: "y", name: "Dashboard", cards: [{ id: "k", type: "ageing", size: "m" }] }] })
  const p = boardFromPreset("collections")
  assert.equal(p.cards.length, 7)
  assert.equal(new Set(p.cards.map((c) => c.id)).size, 7)
})

test("client profile: history, payment behaviour and tax treatment", () => {
  const p = clientProfile(
    [
      { status: "paid", issueDate: "2026-01-01", dueDate: "2026-01-15", paidOn: "2026-01-11" },
      { status: "paid", issueDate: "2026-02-01", dueDate: "2026-02-10", paidOn: "2026-02-21" },
      { status: "sent", issueDate: "2026-03-01", dueDate: "2026-03-15", paidOn: null },
      { status: "draft", issueDate: "2025-01-01", dueDate: null, paidOn: null },
    ],
    [
      { paidOn: "2026-01-11", mode: "upi" },
      { paidOn: "2026-02-21", mode: "upi" },
      { paidOn: "2026-02-05", mode: "cash" },
    ]
  )
  assert.deepEqual(p, { firstInvoice: "2026-01-01", lastInvoice: "2026-03-01", lastPayment: "2026-02-21", avgDaysToPay: 15, onTimeRate: 50, paidInvoices: 2, usualMode: "upi" })
  assert.deepEqual(clientProfile([], []).avgDaysToPay, null)
  assert.equal(taxTreatment({ gstin: "01ABCDE1234F1Z5" }, "01")?.detail, "CGST + SGST")
  assert.equal(taxTreatment({ stateCode: "29" }, "01")?.detail, "IGST")
  assert.equal(taxTreatment({ country: "Singapore" }, "01")?.label, "Export")
  assert.equal(taxTreatment({}, "01"), null)
})

test("TDS helper: rate on taxable value, pro-rated, nearest rupee", () => {
  // ₹24,575 invoice = ₹20,826.27 + 18% GST; 10% TDS on the value excluding GST
  const inv = { total: 2457500, taxable: 2082627, rateBp: 1000 }
  assert.equal(tdsOnSettlement({ ...inv, settle: 2457500 }), 208300)
  assert.deepEqual(splitWithTds({ ...inv, settle: 2457500 }), { received: 2249200, tds: 208300 })
  // half the invoice settled → half the base
  assert.equal(tdsOnSettlement({ ...inv, settle: 1228750 }), 104100)
  // from the amount that reached the bank, gross up
  assert.deepEqual(splitWithTds({ ...inv, received: 2249200 }), { received: 2249200, tds: 208300 })
  assert.equal(tdsOnSettlement({ ...inv, settle: 0 }), 0)
  assert.equal(tdsOnSettlement({ total: 0, taxable: 0, settle: 100, rateBp: 1000 }), 0)
  // never more than the invoice, GST never in the base
  assert.equal(tdsOnSettlement({ total: 11800, taxable: 10000, settle: 999999, rateBp: 1000 }), 1000)
  assert.equal(tdsBase(2457500, 2082627, 2457500), 2082627)
  assert.equal(rateLabel(1000), "10%")
  assert.equal(rateLabel(10), "0.1%")
  assert.equal(tdsLabel("professional"), "Professional services")
  assert.equal(tdsLabel("gone_section"), "gone_section")
  assert.ok(TDS_SECTIONS.every((s, i, all) => all.findIndex((x) => x.key === s.key) === i), "keys are unique")
})

test("TDS report: FY quarters, per client, certificates", () => {
  assert.deepEqual(["2026-04-01", "2026-06-30", "2026-07-01", "2026-12-31", "2027-01-01", "2027-03-31"].map(fyQuarter), [1, 1, 2, 3, 4, 4])
  const base = { clientPan: null, tdsCertificate: false }
  const r = tdsReport([
    { ...base, id: "p1", invoiceId: "i1", clientId: "c1", clientName: "Acme", clientPan: "AABCA1234A", paidOn: "2026-05-10", tdsPaise: 1000, tdsSection: "professional", tdsCertificate: true },
    { ...base, id: "p2", invoiceId: "i1", clientId: "c1", clientName: "Acme", paidOn: "2026-06-10", tdsPaise: 500, tdsSection: "technical" },
    { ...base, id: "p3", invoiceId: "i2", clientId: "c2", clientName: "Beta", paidOn: "2026-05-11", tdsPaise: 2000, tdsSection: "professional", tdsCertificate: true },
    { ...base, id: "p4", invoiceId: "i3", clientId: "c1", clientName: "Acme", paidOn: "2027-02-01", tdsPaise: 300, tdsSection: "professional" },
    { ...base, id: "p5", invoiceId: "i4", clientId: "c3", clientName: "Zero", paidOn: "2026-05-01", tdsPaise: 0, tdsSection: null },
  ])
  assert.equal(r[0].total, 3500)
  assert.deepEqual(
    r[0].rows.map((x) => [x.clientName, x.tds, x.invoices, x.sections.join("+"), x.certificate, x.clientPan]),
    [["Beta", 2000, 1, "professional", "all", null], ["Acme", 1500, 1, "professional+technical", "some", "AABCA1234A"]]
  )
  assert.equal(r[1].rows.length, 0)
  assert.equal(r[3].total, 300)
  assert.equal(r[3].rows[0].certificate, "none")
})

test("credit notes: line and invoice limits, tax like the invoice, cancellation, GST deadline", () => {
  const inv = (pos: string) =>
    ({
      supplyType: "b2b",
      placeOfSupply: pos,
      from: { address: { stateCode: "01" } },
      items: [
        { id: "a", name: "Widget", qty: 2, unit: "pcs", rate: 50000, taxRate: 18 },
        { id: "b", name: "Service", qty: 1, unit: "hrs", rate: 100000, taxRate: 12 },
      ],
      charges: [{ id: "s", label: "Shipping", amount: 10000, taxRate: 18 }],
      roundOff: true,
      payment: { amountPaid: 0 },
    }) as unknown as Parameters<typeof buildCreditNote>[0]
  const intra = inv("01")
  const total = computeInvoiceTotals(intra).total
  const none = { lines: {}, total: 0 }

  const one = buildCreditNote(intra, total, none, { cnDate: "2026-11-28", reason: "sales_return", mode: "items", lines: [{ lineId: "a", kind: "qty", qty: 1 }] })
  assert.ok(one.ok)
  if (one.ok) {
    assert.equal(one.doc.tax_type, "cgst_sgst")
    assert.deepEqual([one.doc.taxable_paise, one.doc.cgst_paise, one.doc.sgst_paise, one.doc.total_paise], [50000, 4500, 4500, 59000])
    assert.equal(one.doc.items[0].orig_taxable_paise, 100000)
  }
  const inter = buildCreditNote(inv("27"), total, none, { cnDate: "2026-11-28", reason: "sales_return", mode: "items", lines: [{ lineId: "b", kind: "amount", amount: 25000 }] })
  assert.ok(inter.ok && inter.doc.tax_type === "igst" && inter.doc.igst_paise === 3000 && inter.doc.items[0].name === "Service (price adjustment)")

  // per line: what earlier notes took counts
  const tooMuch = buildCreditNote(intra, total, { lines: { a: 80000 }, total: 94400 }, { cnDate: "2026-11-28", reason: "sales_return", mode: "items", lines: [{ lineId: "a", kind: "qty", qty: 1 }] })
  assert.ok(!tooMuch.ok && tooMuch.code === "LINE_CREDIT_EXCEEDED" && tooMuch.lineId === "a")
  assert.equal(creditableLines(intra, { lines: { a: 80000 }, total: 0 }).find((l) => l.id === "a")?.remaining, 20000)
  assert.ok(creditableLines(intra, none).some((l) => l.id === "charge:s" && l.charge))

  // lump sum: a rate from the invoice, and not past what's left
  assert.deepEqual(invoiceRates(intra), [12, 18])
  assert.ok(!buildCreditNote(intra, total, none, { cnDate: "2026-11-28", reason: "post_sale_discount", mode: "lump_sum", lump: { description: "Discount", taxable: 1000, rate: 5 } }).ok)
  const lump = buildCreditNote(intra, total, { lines: {}, total: total - 5000 }, { cnDate: "2026-11-28", reason: "post_sale_discount", mode: "lump_sum", lump: { description: "Discount", taxable: 10000, rate: 18 } })
  assert.ok(!lump.ok && lump.code === "CREDIT_EXCEEDS_INVOICE" && lump.maxCreditable === 5000)

  // cancellation: everything left, landing exactly on the invoice total
  const cancel = buildCreditNote(intra, total, none, { cnDate: "2026-11-28", reason: "cancellation", mode: "items", lines: fullRemaining(intra, none) })
  assert.ok(cancel.ok && cancel.doc.total_paise === total && Math.abs(cancel.doc.round_off_paise) <= 100)

  // GST time limit: 30 November after the invoice's FY ends
  assert.equal(gstDeadline("2025-03-31"), "2025-11-30")
  assert.equal(gstDeadline("2025-04-01"), "2026-11-30")
  assert.equal(isLateForGst("2025-03-31", "2025-11-30"), false)
  assert.equal(isLateForGst("2025-03-31", "2025-12-01"), true)
})

test("statement: credit notes are credits, refunds debits, closing reconciles", () => {
  const s = buildStatement({
    from: "2026-04-01",
    to: "2027-03-31",
    invoices: [{ id: "i1", number: "INV/1", issueDate: "2026-05-01", total: 118000, createdAt: "2026-05-01T00:00:00Z" }],
    payments: [{ id: "p1", invoiceId: "i1", invoiceNumber: "INV/1", paidOn: "2026-05-10", amount: 118000, mode: "upi", createdAt: "2026-05-10T00:00:00Z" }],
    creditNotes: [{ id: "c1", number: "CN/26-27/001", date: "2026-05-20", total: 59000, invoiceId: "i1", invoiceNumber: "INV/1", reason: "sales_return", createdAt: "2026-05-20T00:00:00Z" }],
    refunds: [{ id: "r1", creditNoteId: "c1", creditNoteNumber: "CN/26-27/001", date: "2026-05-25", amount: 59000, mode: "bank_transfer", createdAt: "2026-05-25T00:00:00Z" }],
  })
  assert.deepEqual(s.rows.map((r) => [r.kind, r.debit, r.credit, r.balance]), [
    ["invoice", 118000, 0, 118000],
    ["payment", 0, 118000, 0],
    ["credit_note", 0, 59000, -59000],
    ["refund", 59000, 0, 0],
  ])
  assert.equal(s.closing, 0) // paid in full, the credit refunded: nothing owed either way
  assert.deepEqual([s.invoiced, s.received, s.credited, s.refunded], [118000, 118000, 59000, 59000])
  assert.equal(STATEMENT_KIND.credit_note, "Credit note")
})


/* ------------------------------ quotes & proformas ------------------------------ */

test("quote status: stored statuses win, then Expired, Viewed, Sent", () => {
  const today = "2026-11-28"
  for (const st of ["void", "converted", "accepted", "declined", "draft"] as const) assert.equal(displayStatus({ status: st, validUntil: "2026-01-01", viewedAt: "x" }, today), st)
  assert.equal(displayStatus({ status: "sent", validUntil: "2026-11-27", viewedAt: "x" }, today), "expired")
  assert.equal(displayStatus({ status: "sent", validUntil: "2026-11-28", viewedAt: "x" }, today), "viewed", "valid until today is not expired")
  assert.equal(displayStatus({ status: "sent", validUntil: "2026-11-28", viewedAt: null }, today), "sent")
  assert.equal(displayStatus({ status: "sent", validUntil: null }, today), "sent", "a proforma with no date never expires")
  assert.deepEqual(DISPLAY_ORDER, ["void", "converted", "accepted", "declined", "draft", "expired", "viewed", "sent"])
})

test("quote validity: presets, days left and the red/amber tone", () => {
  assert.equal(validUntilFrom("2026-11-28", 15), "2026-12-13")
  assert.equal(validUntilFrom("2027-03-25", 7), "2027-04-01")
  assert.equal(validityPreset("2026-11-28", "2026-12-28"), 30)
  assert.equal(validityPreset("2026-11-28", "2026-12-01"), "custom")
  assert.equal(validityPreset("2026-11-28", null), null)
  assert.equal(daysLeft("2026-11-30", "2026-11-28"), 2)
  assert.equal(daysLeft("2026-11-27", "2026-11-28"), -1)
  assert.equal(validityTone({ status: "sent", validUntil: "2026-11-27" }, "2026-11-28"), "danger")
  assert.equal(validityTone({ status: "sent", validUntil: "2026-12-01" }, "2026-11-28"), "warning")
  assert.equal(validityTone({ status: "sent", validUntil: "2026-12-02" }, "2026-11-28"), null)
  assert.equal(validityTone({ status: "accepted", validUntil: "2026-11-01" }, "2026-11-28"), null)
  assert.deepEqual(defaultMeta("quote", { issueDate: "2026-11-28", validityDays: 30, title: "Estimate" }), { kind: "quote", title: "Estimate", validUntil: "2026-12-28" })
  assert.deepEqual(defaultMeta("proforma", { issueDate: "2026-11-28" }), { kind: "proforma", title: "Proforma Invoice", validUntil: null })
})

test("quote wording", () => {
  assert.equal(quoteLabel("QT/26-27/001"), "QT/26-27/001")
  assert.equal(quoteLabel("QT/26-27/001", 2), "QT/26-27/001 (Rev 2)")
  assert.match(footnote("quote"), /not a tax invoice/)
  assert.match(footnote("proforma"), /tax invoice will be issued/)
  assert.equal(quoteEmailSubject("quote", "QT/26-27/001", "Acme", "₹29,500"), "Quotation QT/26-27/001 from Acme – ₹29,500")
  assert.equal(quoteEmailSubject("proforma", "PI/26-27/001", "Acme", "₹29,500"), "Proforma invoice PI/26-27/001 from Acme – ₹29,500")
  assert.equal(
    quoteWhatsappText({ kind: "quote", clientName: "Junaid", number: "QT/26-27/001", amount: "₹29,500", validUntil: "13 Dec 2026", link: "https://x/q/t" }),
    "Hi Junaid, here's our quotation QT/26-27/001 for ₹29,500, valid until 13 Dec 2026: https://x/q/t"
  )
})

test("quote conversion: remaining quantities and limits", () => {
  const items = [
    { id: "a", name: "Design", unit: "hrs", qty: 10 },
    { id: "b", name: "Hosting", unit: "yr", qty: 1.5 },
  ]
  const left = remainingLines(items, [{ lines: [{ id: "a", qty: 4 }] }, { lines: [{ id: "a", qty: 2.5 }, { id: "b", qty: 0.5 }] }])
  assert.deepEqual(
    left.map((l) => [l.id, l.converted, l.remaining]),
    [
      ["a", 6.5, 3.5],
      ["b", 0.5, 1],
    ]
  )
  assert.equal(checkConversion([{ id: "a", qty: 3.5 }], left), null)
  assert.match(checkConversion([{ id: "a", qty: 3.6 }], left) ?? "", /Only 3.5 hrs/)
  assert.match(checkConversion([{ id: "a", qty: 0 }], left) ?? "", /above 0/)
  assert.match(checkConversion([{ id: "z", qty: 1 }], left) ?? "", /isn't on this quote/)
  assert.match(checkConversion([{ id: "a", qty: 1 }, { id: "a", qty: 1 }], left) ?? "", /isn't on this quote/)
  assert.match(checkConversion([], left) ?? "", /at least one/)
  // float drift (0.1 + 0.2) doesn't leave a sliver behind
  const drift = remainingLines([{ id: "x", name: "X", unit: "kg", qty: 0.3 }], [{ lines: [{ id: "x", qty: 0.1 }] }, { lines: [{ id: "x", qty: 0.2 }] }])
  assert.equal(drift[0].remaining, 0)
})

test("quote conversion: the new invoice copies everything and totals match to the paise", () => {
  const quote = { ...sampleQuote(), quote: { kind: "quote" as const, title: "Quotation" as const, validUntil: "2026-12-13" } }
  const src = { kind: "quote" as const, id: "q1", number: "QT/26-27/001" }
  const inv = conversionDocument(quote, src, "invoice", { newId: "inv_new", today: "2026-11-28" })
  assert.equal(inv.id, "inv_new")
  assert.equal(inv.number, "")
  assert.equal(inv.status, "draft")
  assert.equal(inv.quote, undefined)
  assert.equal(inv.issueDate, "2026-11-28")
  assert.equal(inv.dueDate, "2026-12-28", "net 30 from today")
  assert.equal(inv.title, "Tax Invoice")
  assert.deepEqual(inv.source, { type: "quote", id: "q1", number: "QT/26-27/001" })
  for (const k of ["notes", "terms", "templateId", "pageColor", "language", "signature", "customFields", "invoiceDiscount", "charges", "clientId", "billTo", "items"] as const) assert.deepEqual(inv[k], quote[k], k)
  assert.equal(computeInvoiceTotals(inv).total, computeInvoiceTotals(quote).total)

  const part = conversionDocument(quote, src, "invoice", { newId: "inv_p", today: "2026-11-28", lines: [{ id: "l1", qty: 4 }] })
  assert.deepEqual(
    part.items.map((i) => [i.id, i.qty]),
    [["l1", 4]]
  )

  const pf = conversionDocument(quote, src, "proforma", { newId: "pf", today: "2026-11-28" })
  assert.deepEqual(pf.quote, { kind: "proforma", title: "Proforma Invoice", validUntil: null })
  assert.equal(computeInvoiceTotals(pf).total, computeInvoiceTotals(quote).total)

  assert.equal(termDays({ paymentTerms: "custom", issueDate: "2026-11-01", dueDate: "2026-11-21" }), 20)
  assert.equal(termDays({ paymentTerms: "custom", issueDate: "2026-11-01", dueDate: "" }), 15)
  assert.equal(termDays({ paymentTerms: "due_on_receipt", issueDate: "2026-11-01", dueDate: "" }), 0)
})

function sampleQuote() {
  return {
    id: "q1",
    businessId: "b",
    number: "QT/26-27/001",
    title: "Tax Invoice" as const,
    status: "sent" as const,
    templateId: "standard",
    pageColor: "black" as const,
    issueDate: "2026-11-20",
    dueDate: "2026-11-20",
    paymentTerms: "net_30" as const,
    currency: "INR",
    reverseCharge: false,
    from: { name: "Acme", gstin: "27ABCDE1234F1Z5", address: { line1: "1", city: "Pune", stateCode: "27", country: "India" } },
    clientId: "c1",
    billTo: { name: "Junaid", address: { line1: "2", city: "Bengaluru", stateCode: "29", country: "India" } },
    placeOfSupply: "29",
    supplyType: "b2b" as const,
    items: [
      { id: "l1", name: "Design", qty: 10, unit: "hrs", rate: 150000, taxRate: 18, discount: { kind: "percent" as const, value: 10 } },
      { id: "l2", name: "Hosting", qty: 1, unit: "yr", rate: 499900, taxRate: 18 },
    ],
    invoiceDiscount: { kind: "amount" as const, value: 10000 },
    charges: [{ id: "ch", label: "Travel", amount: 50000, taxRate: 18 }],
    roundOff: true,
    showAmountInWords: true,
    payment: { showUpiQr: true, upiId: "acme@hdfc", showBank: false, paymentLink: false, amountPaid: 0 },
    notes: "Thanks",
    terms: "50% advance",
    signature: { show: true, kind: "type" as const, typedName: "R", label: "Authorised Signatory" },
    customFields: [{ id: "cf", label: "Project", value: "Site" }],
    attachments: [],
    columns: { hsn: true, unit: true, discount: true, tax: true },
    dateFormat: "DD MMM YYYY" as const,
    language: "en" as const,
    linkActive: true,
    revision: 2,
    createdAt: "2026-11-20",
    updatedAt: "2026-11-20",
  }
}
