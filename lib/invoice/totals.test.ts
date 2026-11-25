// Run with: npm test   (node --test with type stripping; no extra deps)
import { test } from "node:test"
import assert from "node:assert/strict"

import { allocate, amountInWords, computeInvoiceTotals, formatMoney, numberToIndianWords } from "./totals.ts"
import type { Invoice, LineItem } from "./types.ts"

function invoice(overrides: Partial<Invoice> = {}, items: Partial<LineItem>[] = []): Invoice {
  return {
    id: "t",
    businessId: "b",
    number: "INV/26-27/015",
    title: "Tax Invoice",
    status: "draft",
    templateId: "standard",
    pageColor: "white",
    issueDate: "2026-11-01",
    dueDate: "2026-12-31",
    paymentTerms: "custom",
    currency: "INR",
    reverseCharge: false,
    from: { name: "Seller", address: { line1: "x", city: "Srinagar", stateCode: "01", country: "India" } },
    clientId: "c",
    billTo: { name: "Buyer", address: { line1: "y", city: "Mumbai", stateCode: "27", country: "India" } },
    placeOfSupply: "27",
    supplyType: "b2b",
    items: items.map((it, i) => ({ id: `l${i}`, name: `Item ${i}`, qty: 1, unit: "pcs", rate: 0, taxRate: 18, ...it })),
    charges: [],
    roundOff: true,
    showAmountInWords: true,
    payment: { showUpiQr: true, showBank: false, paymentLink: false, amountPaid: 0 },
    customFields: [],
    attachments: [],
    columns: { hsn: true, unit: true, discount: false, tax: true },
    dateFormat: "DD MMM YYYY",
    language: "en",
    linkActive: true,
    revision: 1,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  }
}

test("spec test case: J&K seller, Maharashtra place of supply, IGST with round off", () => {
  const t = computeInvoiceTotals(
    invoice({}, [
      { name: "Menu card design", qty: 1, rate: 4000_00, taxRate: 18 },
      { name: "Premium plan", qty: 1, rate: 999_00, taxRate: 18 },
    ])
  )
  assert.equal(t.mode, "inter")
  assert.equal(t.subtotal, 4999_00)
  assert.deepEqual(t.taxRows, [{ kind: "IGST", rate: 18, taxable: 4999_00, amount: 899_82 }])
  assert.equal(t.roundOff, 18)
  assert.equal(t.total, 5899_00)
  assert.equal(t.showTotalExclTax, false)
  assert.equal(formatMoney(t.taxRows[0].amount), "₹899.82")
  assert.equal(formatMoney(t.roundOff, { sign: true }), "+₹0.18")
  assert.equal(formatMoney(t.total, { whole: true }), "₹5,899")
  assert.equal(amountInWords(t.total), "Rupees Five Thousand Eight Hundred Ninety-Nine Only")
})

test("intra-state splits tax 50/50 into CGST and SGST", () => {
  const t = computeInvoiceTotals(invoice({ placeOfSupply: "01" }, [{ qty: 1, rate: 4999_00, taxRate: 18 }]))
  assert.equal(t.mode, "intra")
  assert.deepEqual(
    t.taxRows.map((r) => [r.kind, r.rate, r.amount]),
    [
      ["CGST", 9, 449_91],
      ["SGST", 9, 449_91],
    ]
  )
  assert.equal(t.taxTotal, 899_82)
})

test("odd tax paise split keeps the exact total", () => {
  const t = computeInvoiceTotals(invoice({ placeOfSupply: "01", roundOff: false }, [{ qty: 1, rate: 1_05, taxRate: 5 }]))
  // 105 paise × 5% = 5.25 → 5 paise; CGST 3 (half-up of 2.5), SGST 2
  assert.equal(t.taxTotal, 5)
  assert.equal(t.taxRows[0].amount + t.taxRows[1].amount, 5)
})

test("line discount, decimal qty, exempt line", () => {
  const t = computeInvoiceTotals(
    invoice({ roundOff: false }, [
      { qty: 2.5, rate: 100_00, taxRate: 18, discount: { kind: "percent", value: 10 } }, // 250 − 25 = 225
      { qty: 1, rate: 50_00, taxRate: 18, taxCategory: "exempt" },
    ])
  )
  assert.equal(t.lines[0].base, 225_00)
  assert.equal(t.lines[1].tax, 0)
  assert.equal(t.subtotal, 275_00)
  assert.equal(t.taxTotal, 40_50)
  assert.equal(t.total, 315_50)
})

test("invoice discount spreads across lines in proportion and taxes after it", () => {
  const t = computeInvoiceTotals(
    invoice({ invoiceDiscount: { kind: "amount", value: 100_00 }, roundOff: false }, [
      { qty: 1, rate: 300_00, taxRate: 18 },
      { qty: 1, rate: 100_00, taxRate: 5 },
    ])
  )
  assert.deepEqual(t.lines.map((l) => l.invoiceDiscountShare), [75_00, 25_00])
  assert.equal(t.taxableTotal, 300_00)
  assert.equal(t.taxTotal, 225_00 * 0.18 + 75_00 * 0.05)
  assert.equal(t.showTotalExclTax, true)
})

test("charges are taxed at their own rate; TCS and amount paid", () => {
  const t = computeInvoiceTotals(
    invoice(
      {
        roundOff: false,
        charges: [{ id: "c1", label: "Shipping", amount: 100_00, taxRate: 5 }],
        tcs: { rate: 0.1 },
        payment: { showUpiQr: true, showBank: false, paymentLink: false, amountPaid: 500_00 },
      },
      [{ qty: 1, rate: 1000_00, taxRate: 18 }]
    )
  )
  assert.equal(t.chargesTotal, 100_00)
  assert.equal(t.taxTotal, 180_00 + 5_00)
  assert.equal(t.beforeRound, 1285_00 + 1_29) // TCS 0.1% of 1285.00 = 1.285 → 1.29
  assert.equal(t.balanceDue, t.total - 500_00)
})

test("export is zero-rated", () => {
  const t = computeInvoiceTotals(invoice({ supplyType: "export", placeOfSupply: "96" }, [{ qty: 1, rate: 1000_00, taxRate: 18 }]))
  assert.equal(t.mode, "export")
  assert.equal(t.taxTotal, 0)
  assert.equal(t.total, 1000_00)
})

test("allocate adds up exactly", () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33])
  assert.equal(allocate(1001, [7, 3, 9, 11]).reduce((a, b) => a + b, 0), 1001)
})

test("Indian formatting and words", () => {
  assert.equal(formatMoney(12345678), "₹1,23,456.78")
  assert.equal(numberToIndianWords(12_34_56_789), "Twelve Crore Thirty-Four Lakh Fifty-Six Thousand Seven Hundred Eighty-Nine")
  assert.equal(amountInWords(100_50), "Rupees One Hundred and Fifty Paise Only")
})
