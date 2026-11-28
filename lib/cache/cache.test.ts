// Run with: npm test
import { test } from "node:test"
import assert from "node:assert/strict"

import { qk } from "../query-keys.ts"
import { tag, tagsFor, type ChangeEvent } from "./tags.ts"

const EVENTS: ChangeEvent[] = ["invoice", "payment", "credit_note", "client", "item", "quote", "settings"]

test("every server cache tag for a change is scoped to that user (or to one record)", () => {
  const A = "11111111-aaaa", B = "22222222-bbbb"
  for (const e of EVENTS) {
    const a = tagsFor(e, A, { invoiceId: "inv_1", clientId: "c_1" })
    const b = tagsFor(e, B)
    assert.ok(a.length > 0, e)
    for (const t of a) assert.ok(t.endsWith(`:${A}`) || t === tag.invoice("inv_1") || t === tag.client("c_1"), `${e}: ${t}`)
    // nothing user A's change expires is a tag of user B's
    for (const t of a) assert.ok(!b.includes(t), `${e}: ${t} shared`)
  }
})

test("money changes expire the dashboard; payments also the payment and receipt lists", () => {
  for (const e of ["invoice", "payment", "credit_note", "quote", "client"] as const) assert.ok(tagsFor(e, "u").includes(tag.dashboard("u")), e)
  assert.ok(tagsFor("payment", "u").includes(tag.payments("u")))
  assert.ok(tagsFor("payment", "u").includes(tag.receipts("u")))
  assert.ok(tagsFor("credit_note", "u").includes(tag.creditNotes("u")))
  assert.ok(tagsFor("invoice", "u", { invoiceId: "i9" }).includes(tag.invoice("i9")))
})

test("browser query keys start with the user", () => {
  assert.deepEqual(qk.overview("A").slice(0, 2), ["u", "A"])
  assert.notDeepEqual(qk.overview("A"), qk.overview("B"))
  assert.deepEqual(qk.all("A"), ["u", "A"])
})
