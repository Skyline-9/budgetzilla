const DB_NAME = "transformers-model-cache";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

interface CacheEntry {
  data: ArrayBuffer;
  headers: Record<string, string>;
}

async function getBlob(key: string): Promise<CacheEntry | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? undefined);
    req.onerror = () => reject(req.error);
  });
}

async function putBlob(key: string, data: ArrayBuffer, headers: Record<string, string>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ data, headers } satisfies CacheEntry, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteBlob(key: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export const idbModelCache = {
  async match(request: string): Promise<Response | undefined> {
    try {
      const entry = await getBlob(request);
      if (!entry) return undefined;
      return new Response(entry.data, { headers: entry.headers });
    } catch {
      return undefined;
    }
  },

  async put(request: string, response: Response): Promise<void> {
    try {
      const clone = response.clone();
      const data = await clone.arrayBuffer();
      const headers: Record<string, string> = {};
      clone.headers.forEach((v, k) => { headers[k] = v; });
      await putBlob(request, data, headers);
    } catch (e) {
      console.warn("IDB cache put failed (quota?):", e);
    }
  },

  async delete(request: string): Promise<boolean> {
    try {
      return await deleteBlob(request);
    } catch {
      return false;
    }
  },
};
