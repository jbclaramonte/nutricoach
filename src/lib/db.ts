const DB_NAME = 'nutriadapt'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = work(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

/** Lit une valeur ; renvoie undefined si la clé est absente. */
export function dbGet<T>(key: string): Promise<T | undefined> {
  return run<T | undefined>('readonly', (store) => store.get(key) as IDBRequest<T | undefined>)
}

/** Écrit une valeur, en remplaçant celle qui existe. */
export function dbSet<T>(key: string, value: T): Promise<void> {
  return run('readwrite', (store) => store.put(value, key) as IDBRequest<IDBValidKey>).then(() => undefined)
}

/** Supprime une clé ; ne fait rien si elle est absente. */
export function dbDelete(key: string): Promise<void> {
  return run('readwrite', (store) => store.delete(key) as IDBRequest<undefined>).then(() => undefined)
}

/** Liste les clés existantes, pour faire le ménage des entrées périmées. */
export function dbKeys(): Promise<string[]> {
  return run<IDBValidKey[]>('readonly', (store) => store.getAllKeys()).then((keys) =>
    keys.filter((key): key is string => typeof key === 'string'),
  )
}
