/**
 * Device key store: keeps the vault's NON-EXTRACTABLE session key in IndexedDB
 * so the app stays unlocked across reloads on this device. The key's raw bytes
 * cannot be read by any script (browser-enforced); the server never sees it.
 * Every function fails soft — the worst case is the user types their password.
 */

const DB = 'll-keystore', STORE = 'keys', VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null; // tests / very old browsers
  try {
    const db = await open();
    return await new Promise<T | null>((res) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => { res(req.result ?? null); db.close(); };
      req.onerror = () => { res(null); db.close(); };
    });
  } catch { return null; }
}

export async function saveSessionKey(userId: string, key: CryptoKey): Promise<void> {
  await run('readwrite', (s) => s.put(key, userId));
}

export async function loadSessionKey(userId: string): Promise<CryptoKey | null> {
  const v = await run('readonly', (s) => s.get(userId));
  return v instanceof CryptoKey ? v : null;
}

export async function clearSessionKeys(): Promise<void> {
  await run('readwrite', (s) => s.clear());
}
