import type { StoragePort } from '@almanac/core';

/**
 * Web `StoragePort` over `localStorage` (L6 — data on device). The Tauri shell
 * will swap in a native/SQLite adapter behind the same contract; the mobile
 * client its platform store. A storage failure surfaces to the day-store, which
 * degrades that slice to its default (L5).
 */
export function createLocalStoragePort(): StoragePort {
  const store = globalThis.localStorage;
  return {
    read: (key) => Promise.resolve(store.getItem(key)),
    readMany: (keys) => Promise.resolve(keys.map((key) => store.getItem(key))),
    write: (key, value) => {
      store.setItem(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      store.removeItem(key);
      return Promise.resolve();
    },
    keys: (prefix) =>
      Promise.resolve(
        Object.keys(store).filter((k) => prefix === undefined || k.startsWith(prefix)),
      ),
  };
}
