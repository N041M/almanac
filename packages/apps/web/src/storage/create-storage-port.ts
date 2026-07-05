import type { StoragePort } from '@almanac/core';
import { createLocalStoragePort } from './local-storage-port';
import { createSqliteStoragePort } from './sqlite-storage-port';

/** The Tauri host injects this marker into its webview before any app code. */
const isTauri = (): boolean => '__TAURI_INTERNALS__' in globalThis;

/**
 * Picks the `StoragePort` for the environment: SQLite via the Tauri sql plugin
 * in the desktop shell, `localStorage` in the plain web port. The renderer
 * needs a port synchronously but the database opens async, so the SQLite path
 * opens lazily on first use; if it can't (plugin missing, disk error), it
 * degrades once and quietly to `localStorage` — still on-device, and slice
 * isolation above handles the rest (L5).
 */
export function createStoragePort(): StoragePort {
  if (!isTauri()) return createLocalStoragePort();

  let backend: Promise<StoragePort> | undefined;
  const open = (): Promise<StoragePort> =>
    (backend ??= (async () => {
      try {
        const { default: Database } = await import('@tauri-apps/plugin-sql');
        return await createSqliteStoragePort(await Database.load('sqlite:almanac.db'));
      } catch {
        return createLocalStoragePort();
      }
    })());

  return {
    read: async (key) => (await open()).read(key),
    readMany: async (keys) => {
      const port = await open();
      return port.readMany
        ? port.readMany(keys)
        : Promise.all(keys.map((key) => port.read(key)));
    },
    write: async (key, value) => (await open()).write(key, value),
    remove: async (key) => (await open()).remove(key),
    keys: async (prefix) => (await open()).keys(prefix),
  };
}
