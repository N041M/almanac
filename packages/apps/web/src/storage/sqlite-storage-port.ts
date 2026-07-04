import type { StoragePort } from '@almanac/core';

/**
 * The slice of `@tauri-apps/plugin-sql`'s `Database` the adapter needs — kept
 * minimal so tests (and any future backend) can supply their own.
 */
export interface SqlDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

/** One key–value row per storage key; slice codecs above own the value shape. */
const CREATE_TABLE =
  'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)';

/** SQLite caps bound parameters (999 on older builds); stay well under. */
export const READ_MANY_CHUNK = 400;

/** `%`/`_` are LIKE wildcards; storage keys may contain them. */
const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const placeholders = (n: number): string =>
  Array.from({ length: n }, (_, i) => `$${i + 1}`).join(', ');

/**
 * Desktop `StoragePort` over SQLite (L6 — the on-device store). Ensures the
 * table exists before resolving; query errors propagate to the day-store,
 * which degrades the affected slice in isolation (L5).
 */
export async function createSqliteStoragePort(db: SqlDatabase): Promise<StoragePort> {
  await db.execute(CREATE_TABLE);

  return {
    read: async (key) => {
      const rows = await db.select<{ value: string }[]>(
        'SELECT value FROM kv WHERE key = $1',
        [key],
      );
      return rows[0]?.value ?? null;
    },

    readMany: async (keys) => {
      const found = new Map<string, string>();
      for (let at = 0; at < keys.length; at += READ_MANY_CHUNK) {
        const chunk = keys.slice(at, at + READ_MANY_CHUNK);
        const rows = await db.select<{ key: string; value: string }[]>(
          `SELECT key, value FROM kv WHERE key IN (${placeholders(chunk.length)})`,
          [...chunk],
        );
        for (const row of rows) found.set(row.key, row.value);
      }
      return keys.map((key) => found.get(key) ?? null);
    },

    write: async (key, value) => {
      await db.execute(
        'INSERT INTO kv (key, value) VALUES ($1, $2) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    },

    remove: async (key) => {
      await db.execute('DELETE FROM kv WHERE key = $1', [key]);
    },

    keys: async (prefix) => {
      const rows =
        prefix === undefined
          ? await db.select<{ key: string }[]>('SELECT key FROM kv')
          : await db.select<{ key: string }[]>(
              "SELECT key FROM kv WHERE key LIKE $1 ESCAPE '\\'",
              [`${escapeLike(prefix)}%`],
            );
      return rows.map((row) => row.key);
    },
  };
}
