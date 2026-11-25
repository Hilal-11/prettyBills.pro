/** Tiny IndexedDB key-value store for unsynced invoice drafts. */
const DB = "prettybill"
const STORE = "drafts"

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const idb = {
  get: <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key) as IDBRequest<T | undefined>).catch(() => undefined),
  set: (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key)).catch(() => undefined),
  del: (key: string) => run("readwrite", (s) => s.delete(key)).catch(() => undefined),
  clear: () => run("readwrite", (s) => s.clear()).catch(() => undefined),
}
