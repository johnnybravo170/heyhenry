/**
 * Offline-capture queue for field photo capture.
 *
 * Field reality: no signal at the back of the basement. The mobile uploader
 * must keep working offline — captures land in IndexedDB (which stores Blobs
 * natively, no base64 bloat) and flush to the server the moment signal
 * returns. This module is the persistence + flush primitive; the React layer
 * (`OfflineCaptureQueue`) owns the UI and reconnect wiring.
 *
 * Scope (honest): this is a real local-persist + reconnect-sync queue for the
 * photo-capture path. It is NOT a general-purpose background-sync engine —
 * there's no Service Worker / Background Sync API registration, so a flush
 * only runs while the tab is open (on the `online` event or an explicit
 * retry). That covers the "snap in the basement, walk upstairs, watch them
 * go" loop. A true background sync (uploads complete with the tab closed)
 * is a follow-up — see the report.
 *
 * Built dependency-free against the raw IndexedDB API so we don't pull in an
 * idb wrapper for one store.
 */

const DB_NAME = 'heyhenry-capture';
const STORE = 'queue';
const DB_VERSION = 1;

export type QueuedCaptureStatus = 'waiting' | 'syncing' | 'failed';

export type QueuedCapture = {
  id: string;
  projectId: string;
  /** The (already client-resized) image blob. */
  blob: Blob;
  fileName: string;
  tag: string;
  caption: string;
  /** bytes, for the queue row size readout. */
  bytes: number;
  capturedAt: number;
  status: QueuedCaptureStatus;
  /** Last error message, when status === 'failed'. */
  error?: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
        t.oncomplete = () => db.close();
      }),
  );
}

export async function enqueueCapture(item: QueuedCapture): Promise<void> {
  if (!isBrowser()) return;
  await tx('readwrite', (s) => s.put(item));
}

export async function listCaptures(projectId: string): Promise<QueuedCapture[]> {
  if (!isBrowser()) return [];
  const all = await tx<QueuedCapture[]>(
    'readonly',
    (s) => s.getAll() as IDBRequest<QueuedCapture[]>,
  );
  return all.filter((c) => c.projectId === projectId).sort((a, b) => a.capturedAt - b.capturedAt);
}

export async function updateCapture(
  id: string,
  patch: Partial<Pick<QueuedCapture, 'status' | 'error'>>,
): Promise<void> {
  if (!isBrowser()) return;
  const existing = await tx<QueuedCapture | undefined>(
    'readonly',
    (s) => s.get(id) as IDBRequest<QueuedCapture | undefined>,
  );
  if (!existing) return;
  await tx('readwrite', (s) => s.put({ ...existing, ...patch }));
}

export async function removeCapture(id: string): Promise<void> {
  if (!isBrowser()) return;
  await tx('readwrite', (s) => s.delete(id));
}

export function makeCaptureId(): string {
  return `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
