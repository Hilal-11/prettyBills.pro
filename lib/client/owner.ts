import { idb } from "./idb"
import { KEYS, readLocal, writeLocal } from "./local"

/** Layout preferences that aren't personal data and can survive a change of account. */
const KEEP = new Set<string>([KEYS.view, KEYS.split])

/**
 * Drafts, clients and business details kept in this browser belong to one
 * account. When a different user signs in here, the previous user's local
 * data is wiped before the editor reads it. Data from before sign-in existed
 * is handed to the first user who signs in.
 */
export async function claimLocalData(userId: string) {
  const previous = readLocal<string | null>(KEYS.owner, null)
  if (previous === userId) return
  if (previous) {
    for (const key of Object.values(KEYS)) {
      if (KEEP.has(key)) continue
      try {
        localStorage.removeItem(key)
      } catch {}
    }
    await idb.clear()
  }
  writeLocal(KEYS.owner, userId)
}
