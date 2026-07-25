"use client"

export interface GeneratedImage {
  id: string
  /** data URL of the generated image */
  dataUrl: string
  prompt: string
  /** optional scene metadata from the pipeline */
  sceneIndex: number | null
  sceneTitle: string | null
  model: string
  createdAt: number
}

const DB_NAME = "mps-images"
const STORE = "generated"
const VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

export async function saveImage(image: GeneratedImage): Promise<void> {
  await tx("readwrite", (s) => s.put(image))
}

export async function listImages(): Promise<GeneratedImage[]> {
  const all = await tx<GeneratedImage[]>("readonly", (s) => s.getAll())
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteImage(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id))
}
