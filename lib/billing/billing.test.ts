// Run with: npm test
import { test } from "node:test"
import assert from "node:assert/strict"

import { BOM, csvAmount, csvCell, csvRow } from "./csv.ts"
import { parseFilters, filtersQuery } from "./filters.ts"
import { addDays, daysBetween, formatDate, fyLabel, fyRange, isISODate, presetRange, todayIST } from "./dates.ts"
import { billingCodeOf, billingMessage } from "./errors.ts"
import { buildStatement, receiptBalance } from "./ledger.ts"
import { referenceHint, referenceLabel } from "./modes.ts"
import { amountInWordsINR, formatINR, paiseToInput, percentOf, toPaise } from "./money.ts"
import { getDisplayStatus } from "./status.ts"
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
  assert.equal(billingMessage("OVERPAYMENT", "1457500"), "Amount is more than the balance due (₹14,575.00). Enter ₹14,575.00 or less.")
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
