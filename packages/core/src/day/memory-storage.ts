import type { StoragePort } from '../ports/storage.js';

/**
 * In-memory `StoragePort` — the reference adapter for tests and first-run. Real
 * clients swap in IndexedDB / the platform store behind the same contract (L3).
 */
export function createMemoryStorage(seed?: Record<string, string>): StoragePort {
  const map = new Map<string, string>(seed !== undefined ? Object.entries(seed) : []);
  return {
    read: (key) => Promise.resolve(map.get(key) ?? null),
    readMany: (keys) => Promise.resolve(keys.map((key) => map.get(key) ?? null)),
    write: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
    keys: (prefix) =>
      Promise.resolve(
        [...map.keys()].filter((k) => prefix === undefined || k.startsWith(prefix)),
      ),
  };
}
