/**
 * Offline-capture queue for worker time entries.
 *
 * Field reality: the worker logs hours at the back of a basement with no
 * signal. A time entry must never be silently dropped — when the device is
 * offline (or the submit fails), the entry lands in IndexedDB and flushes to
 * the server the moment signal returns.
 *
 * This mirrors the photo `capture-queue.ts` pattern but uses its own
 * IndexedDB database (no shared-version coordination with the photo queue)
 * and stores a plain JSON payload (the `logWorkerTimeAction` input) rather
 * than a Blob.
 *
 * Scope (honest): this is a real local-persist + reconnect-flush queue, but
 * it is NOT a Service-Worker Background-Sync engine — a flush only runs while
 * a tab is open (on the `online` event or an explicit retry). That covers the
 * "log in the basement, walk to the truck, watch it sync" loop. True
 * background sync (entries send with the app closed) is a follow-up — see the
 * worker-app handoff report. The same gap applies to the photo queue.
 *
 * Built dependency-free against the raw IndexedDB API.
 */

const DB_NAME = 'heyhenry-time-capture';
const STORE = 'queue';
const DB_VERSION = 1;

export type QueuedTimeStatus = 'waiting' | 'syncing' | 'failed';

/** The `logWorkerTimeAction` input, plus display fields for the queue rows. */
export type QueuedTimeEntry = {
  id: string;
  project_id: string;
  project_name: string;
  budget_category_id?: string;
  cost_line_id?: string;
  hours: number;
  notes?: string;
  entry_date: string;
  /** Pre-resolved category name for the row readout (no network at render). */
  category_name?: string;
  capturedAt: number;
  status: QueuedTimeStatus;
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

export async function enqueueTime(item: QueuedTimeEntry): Promise<void> {
  if (!isBrowser()) return;
  await tx('readwrite', (s) => s.put(item));
}

export async function listQueuedTime(): Promise<QueuedTimeEntry[]> {
  if (!isBrowser()) return [];
  const all = await tx<QueuedTimeEntry[]>(
    'readonly',
    (s) => s.getAll() as IDBRequest<QueuedTimeEntry[]>,
  );
  return all.sort((a, b) => a.capturedAt - b.capturedAt);
}

export async function updateQueuedTime(
  id: string,
  patch: Partial<Pick<QueuedTimeEntry, 'status' | 'error'>>,
): Promise<void> {
  if (!isBrowser()) return;
  const existing = await tx<QueuedTimeEntry | undefined>(
    'readonly',
    (s) => s.get(id) as IDBRequest<QueuedTimeEntry | undefined>,
  );
  if (!existing) return;
  await tx('readwrite', (s) => s.put({ ...existing, ...patch }));
}

export async function removeQueuedTime(id: string): Promise<void> {
  if (!isBrowser()) return;
  await tx('readwrite', (s) => s.delete(id));
}

export function makeTimeQueueId(): string {
  return `time-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
