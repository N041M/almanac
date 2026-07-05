import type { SqlDatabase } from './sqlite-storage-port';

/**
 * A Map-backed fake that interprets exactly the SQL the SQLite adapter
 * issues, including LIKE-with-ESCAPE semantics, so tests exercise real
 * query/bind shapes rather than mirroring the implementation. Test-only.
 */
export function fakeDb() {
  const rows = new Map<string, string>();
  const selects: { query: string; binds: unknown[] }[] = [];

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const likeToRegExp = (pattern: string): RegExp => {
    let out = '';
    for (let i = 0; i < pattern.length; i += 1) {
      const c = pattern[i] ?? '';
      if (c === '\\') {
        i += 1;
        out += escapeRegExp(pattern[i] ?? '');
      } else if (c === '%') out += '.*';
      else if (c === '_') out += '.';
      else out += escapeRegExp(c);
    }
    return new RegExp(`^${out}$`);
  };

  const db: SqlDatabase = {
    execute: (query, binds = []) => {
      if (query.startsWith('INSERT INTO kv')) {
        rows.set(String(binds[0]), String(binds[1]));
      } else if (query.startsWith('DELETE FROM kv')) {
        rows.delete(String(binds[0]));
      } else if (!query.startsWith('CREATE TABLE')) {
        throw new Error(`unexpected execute: ${query}`);
      }
      return Promise.resolve(undefined);
    },
    select: <T>(query: string, binds: unknown[] = []): Promise<T> => {
      selects.push({ query, binds });
      if (query.startsWith('SELECT value FROM kv')) {
        const value = rows.get(String(binds[0]));
        return Promise.resolve((value === undefined ? [] : [{ value }]) as T);
      }
      if (query.includes('WHERE key IN')) {
        const hits = [...rows]
          .filter(([key]) => binds.includes(key))
          .map(([key, value]) => ({ key, value }));
        return Promise.resolve(hits as T);
      }
      if (query.includes('LIKE')) {
        const re = likeToRegExp(String(binds[0]));
        const keys = [...rows.keys()].filter((key) => re.test(key)).map((key) => ({ key }));
        return Promise.resolve(keys as T);
      }
      return Promise.resolve([...rows.keys()].map((key) => ({ key })) as T);
    },
  };

  return { db, rows, selects };
}
