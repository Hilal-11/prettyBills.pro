// Run with: npm test
import { test } from "node:test"
import assert from "node:assert/strict"

import { nextInvoiceNumber } from "../invoice/format.ts"
import { bucketOf, settleStatus } from "./status.ts"

const today = "2026-11-25"

test("every invoice lands in exactly one bucket", () => {
  assert.equal(bucketOf("draft", "2026-01-01", 500, today), "draft")
  assert.equal(bucketOf("paid", "2026-01-01", 0, today), "paid")
  assert.equal(bucketOf("void", "2026-01-01", 500, today), "void")
  assert.equal(bucketOf("sent", "2026-11-24", 500, today), "overdue")
  assert.equal(bucketOf("viewed", "2026-11-24", 500, today), "overdue")
  assert.equal(bucketOf("partially_paid", "2026-11-01", 200, today), "overdue")
})

test("due today is not overdue; no due date never is", () => {
  assert.equal(bucketOf("sent", today, 500, today), "sent")
  assert.equal(bucketOf("sent", "2026-12-10", 500, today), "sent")
  assert.equal(bucketOf("sent", null, 500, today), "sent")
})

test("nothing owed is never overdue", () => {
  assert.equal(bucketOf("sent", "2026-11-01", 0, today), "sent")
})

test("status follows the money once sent", () => {
  assert.equal(settleStatus("sent", 1000, 1000), "paid")
  assert.equal(settleStatus("viewed", 1000, 1500), "paid")
  assert.equal(settleStatus("sent", 1000, 400), "partially_paid")
  assert.equal(settleStatus("paid", 1000, 0), "sent")
  assert.equal(settleStatus("partially_paid", 1000, 0), "sent")
  assert.equal(settleStatus("viewed", 1000, 0), "viewed")
  assert.equal(settleStatus("overdue", 1000, 0), "sent")
})

test("drafts and void invoices keep their status", () => {
  assert.equal(settleStatus("draft", 1000, 1000), "draft")
  assert.equal(settleStatus("void", 1000, 1000), "void")
  // a zero-value invoice isn't "paid" just because nothing is owed
  assert.equal(settleStatus("sent", 0, 0), "sent")
})

test("next invoice number continues this financial year's series", () => {
  assert.equal(nextInvoiceNumber([], today), "INV/26-27/001")
  assert.equal(nextInvoiceNumber(["INV/26-27/001", "INV/26-27/014", "INV/26-27/003"], today), "INV/26-27/015")
  // last year's series and custom numbers don't count
  assert.equal(nextInvoiceNumber(["INV/25-26/090", "CUSTOM-7"], today), "INV/26-27/001")
  // April starts a new financial year
  assert.equal(nextInvoiceNumber(["INV/26-27/040"], "2027-04-01"), "INV/27-28/001")
})
