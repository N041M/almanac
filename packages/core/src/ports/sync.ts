/**
 * Cross-device sync seam (D1/D4, design §11): **server-durable,
 * locally-cached**. The unit of sync is the per-day, per-module storage slice;
 * the server keeps an authoritative, monotonic revision log. Clients push
 * changed slices (debounced after writes, on app-open, on network-regain) and
 * pull deltas since the last revision they saw. Conflicts resolve as
 * last-writer-wins per slice, silently — single-user data.
 *
 * The app stays fully usable offline against its local store (L5); the web
 * port may read through the server when its cache is cold. Implementation is a
 * late phase; this contract is pinned early so slice data stays sync-ready.
 */
export interface SyncRecord {
  /** Storage key, e.g. `day:2026-07-03:meals`. */
  key: string;
  /** The serialized slice envelope, opaque to the sync layer. */
  value: string;
  /** Server-assigned, monotonic across the account. */
  revision: number;
}

export interface SyncPullResult {
  records: SyncRecord[];
  /** The server's latest revision — the cursor for the next pull. */
  revision: number;
}

export interface SyncPort {
  /** Push locally-changed slices; the server assigns revisions (LWW per key). */
  push(records: ReadonlyArray<Omit<SyncRecord, 'revision'>>): Promise<void>;
  /** Everything changed since `sinceRevision` (0 = full history). */
  pull(sinceRevision: number): Promise<SyncPullResult>;
}
