import type { TranslateApiResult } from './translateApi';

// Cache local (IndexedDB) de resultados de `/api/translate`, para que una
// peticion IDENTICA (mismos bytes de audio + mismos parametros de idioma/voz)
// se resuelva al instante sin volver a llamar a Deepgram/Gemini/ElevenLabs.
// En una conversacion en vivo cada grabacion es unica por naturaleza (nunca
// hay dos blobs de audio identicos byte a byte), asi que esto NO cachea
// "cosas que se dicen parecido" — sirve sobre todo para reintentos tras un
// error de red, y para Clip Studio cuando se vuelve a doblar el mismo clip
// al mismo idioma sin cambiar nada.
const DB_NAME = 'voxlingo-translate-cache';
const STORE_NAME = 'results';
const DB_VERSION = 1;
const MAX_ENTRIES = 40;
const TTL_MS = 30 * 60 * 1000; // 30 minutos

interface CacheEntry {
  key: string;
  result: TranslateApiResult;
  cachedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible en este navegador'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('by_cachedAt', 'cachedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir IndexedDB'));
  });
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Deriva una key estable a partir del hash SHA-256 del audio + los parametros que afectan el resultado. */
export async function computeCacheKey(
  audioBuffer: ArrayBuffer,
  params: Array<string | number | undefined>
): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', audioBuffer);
    const audioHash = bufferToHex(digest);
    return [audioHash, ...params.map((p) => String(p ?? ''))].join('|');
  } catch (err) {
    console.error('[translationCache] No se pudo calcular la cache key (crypto.subtle no disponible?)', err);
    return null;
  }
}

export async function getCachedResult(key: string): Promise<TranslateApiResult | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        if (Date.now() - entry.cachedAt > TTL_MS) {
          resolve(null);
          return;
        }
        resolve(entry.result);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.error('[translationCache] Error leyendo cache, se ignora (fallback a red)', err);
    return null;
  }
}

/** Guarda el resultado en background (no bloquea la respuesta al caller) y recorta entradas viejas si se excede MAX_ENTRIES. */
export function setCachedResult(key: string, result: TranslateApiResult): void {
  void (async () => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ key, result, cachedAt: Date.now() } satisfies CacheEntry);
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      await evictOldEntries(db);
    } catch (err) {
      console.error('[translationCache] Error escribiendo cache, se ignora', err);
    }
  })();
}

async function evictOldEntries(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const countReq = store.count();
    countReq.onsuccess = () => {
      const excess = countReq.result - MAX_ENTRIES;
      if (excess <= 0) {
        resolve();
        return;
      }
      let deleted = 0;
      const cursorReq = store.index('by_cachedAt').openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || deleted >= excess) {
          resolve();
          return;
        }
        cursor.delete();
        deleted += 1;
        cursor.continue();
      };
      cursorReq.onerror = () => resolve();
    };
    countReq.onerror = () => resolve();
  });
}
