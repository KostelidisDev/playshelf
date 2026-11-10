/* The editor's saved copy: the two files as they are in the page, kept in
 * this browser so an edit isn't lost when the page is closed. It's a
 * convenience, not a backup: the browser may delete it at any time, and
 * export is what keeps the changes. Stored as the same CSV text the export
 * writes, so loading it goes through the same checks as opening a file.
 * Every call can fail (private windows, full storage, blocked site data),
 * and then the editor simply has no saved copy. */

const DB_NAME = "playshelf-studio";
const STORE = "catalog";
const KEY = "draft";

/** One of the files, as text, or null when it isn't open. */
export interface Draft {
  readonly games: string | null;
  readonly videos: string | null;
  readonly gamesDirty: boolean;
  readonly videosDirty: boolean;
}

export interface DraftStore {
  /** Whether a copy can be kept at all. False leaves the editor with no saved copy. */
  readonly available: boolean;
  load(): Promise<Draft | null>;
  /** Resolves true once the copy is written. */
  save(draft: Draft): Promise<boolean>;
  /** Resolves true once the copy is gone. */
  clear(): Promise<boolean>;
}

/** The store for a browser without IndexedDB, or none that can be used. */
export const NO_DRAFTS: DraftStore = {
  available: false,
  load: async () => null,
  save: async () => false,
  clear: async () => false,
};

/** The copy kept in this browser, or NO_DRAFTS when IndexedDB isn't there. */
export function browserDraftStore(): DraftStore {
  if (typeof indexedDB === "undefined") return NO_DRAFTS;
  return {
    available: true,
    async load() {
      try {
        const value: unknown = await run("readonly", (store) => store.get(KEY));
        return isDraft(value) ? value : null;
      } catch {
        return null;
      }
    },
    async save(draft) {
      try {
        await run("readwrite", (store) => store.put(draft, KEY));
        return true;
      } catch {
        return false;
      }
    },
    async clear() {
      try {
        await run("readwrite", (store) => store.delete(KEY));
        return true;
      } catch {
        return false;
      }
    },
  };
}

function isDraft(value: unknown): value is Draft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  const text = (v: unknown) => v === null || typeof v === "string";
  return text(draft.games) && text(draft.videos) && typeof draft.gamesDirty === "boolean" && typeof draft.videosDirty === "boolean";
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Runs one request in its own transaction, and resolves with its result once
 * the transaction has committed. */
async function run<T>(mode: IDBTransactionMode, request: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const pending = request(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(pending.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
