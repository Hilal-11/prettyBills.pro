import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { randomToken } from "@/lib/invoice/format"
import type { Invoice } from "@/lib/invoice/types"

/**
 * Short-lived server files. Invoices, clients and everything else users keep
 * live in Postgres (lib/server/db); this is only for scratch data.
 *
 * Layout under PRETTYBILL_DATA_DIR (default ./.data, git-ignored):
 *   print/<token>.json   { invoice, expires }   for PDF rendering, deleted after
 *   outbox/<ts>.json     emails captured when no email provider is configured
 *   feedback/<ts>.json   feedback, in development, until the Supabase table exists
 */

const ROOT = process.env.PRETTYBILL_DATA_DIR ?? path.join(process.cwd(), ".data")
const SAFE = /^[\w-]{1,96}$/

function file(dir: string, id: string) {
  if (!SAFE.test(id)) throw new Error("Invalid id")
  return path.join(ROOT, dir, `${id}.json`)
}

async function readJSON<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(p, "utf8")) as T
  } catch {
    return null
  }
}

async function writeJSON(p: string, data: unknown) {
  await mkdir(path.dirname(p), { recursive: true })
  await writeFile(p, JSON.stringify(data), "utf8")
}

export async function putPrintJob(invoice: Invoice) {
  const token = randomToken(18)
  await writeJSON(file("print", token), { invoice, expires: Date.now() + 2 * 60_000 })
  return token
}

export async function takePrintJob(token: string) {
  const job = await readJSON<{ invoice: Invoice; expires: number }>(file("print", token))
  if (!job || job.expires < Date.now()) return null
  return job.invoice
}

export async function dropPrintJob(token: string) {
  await rm(file("print", token), { force: true })
}

export async function writeOutbox(message: unknown) {
  const id = `${Date.now()}-${randomToken(6).slice(0, 8)}`
  await writeJSON(file("outbox", id), message)
  return path.join(ROOT, "outbox", `${id}.json`)
}

/** Development fallback for feedback when the Supabase table isn't set up yet. */
export async function writeFeedbackLocally(entry: unknown) {
  const id = `${Date.now()}-${randomToken(6).slice(0, 8)}`
  await writeJSON(file("feedback", id), entry)
  return path.join(ROOT, "feedback", `${id}.json`)
}
