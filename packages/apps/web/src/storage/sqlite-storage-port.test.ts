import { describe, expect, it } from 'vitest';
import {
  createSqliteStoragePort,
  READ_MANY_CHUNK,
  type SqlDatabase,
} from './sqlite-storage-port';

/**
 * A Map-backed fake that interprets exactly the SQL the adapter issues,
 * including LIKE-with-ESCAPE semantics, so the tests exercise real
 * query/bind shapes rather than mirroring the implementation.
 */
function fakeDb() {
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

describe('createSqliteStoragePort', () => {
  it('round-trips write/read and returns null for absent keys', async () => {
    const port = await createSqliteStoragePort(fakeDb().db);
    expect(await port.read('day:2026-07-03')).toBeNull();
    await port.write('day:2026-07-03', '{"starred":true}');
    expect(await port.read('day:2026-07-03')).toBe('{"starred":true}');
  });

  it('upserts on repeated writes to one key', async () => {
    const port = await createSqliteStoragePort(fakeDb().db);
    await port.write('k', 'first');
    await port.write('k', 'second');
    expect(await port.read('k')).toBe('second');
  });

  it('removes a key', async () => {
    const port = await createSqliteStoragePort(fakeDb().db);
    await port.write('k', 'v');
    await port.remove('k');
    expect(await port.read('k')).toBeNull();
  });

  it('readMany is index-aligned with nulls for absent keys', async () => {
    const port = await createSqliteStoragePort(fakeDb().db);
    await port.write('a', '1');
    await port.write('c', '3');
    expect(await port.readMany?.(['a', 'b', 'c', 'a'])).toEqual(['1', null, '3', '1']);
  });

  it('readMany of no keys issues no query', async () => {
    const { db, selects } = fakeDb();
    const port = await createSqliteStoragePort(db);
    expect(await port.readMany?.([])).toEqual([]);
    expect(selects).toHaveLength(0);
  });

  it('readMany chunks to stay under the bind-parameter cap', async () => {
    const { db, selects } = fakeDb();
    const port = await createSqliteStoragePort(db);
    const keys = Array.from({ length: READ_MANY_CHUNK + 1 }, (_, i) => `k${i}`);
    await port.readMany?.(keys);
    expect(selects).toHaveLength(2);
    for (const { binds } of selects) expect(binds.length).toBeLessThanOrEqual(READ_MANY_CHUNK);
  });

  it('keys() lists everything; keys(prefix) filters', async () => {
    const port = await createSqliteStoragePort(fakeDb().db);
    await port.write('day:2026-07-01', 'a');
    await port.write('day:2026-07-02', 'b');
    await port.write('settings', 'c');
    expect((await port.keys()).sort()).toEqual(['day:2026-07-01', 'day:2026-07-02', 'settings']);
    expect((await port.keys('day:')).sort()).toEqual(['day:2026-07-01', 'day:2026-07-02']);
  });

  it('treats LIKE wildcards in a prefix as literals', async () => {
    const port = await createSqliteStoragePort(fakeDb().db);
    await port.write('a%b:1', 'wild');
    await port.write('axb:1', 'plain');
    await port.write('a_b:1', 'under');
    expect(await port.keys('a%b')).toEqual(['a%b:1']);
    expect(await port.keys('a_b')).toEqual(['a_b:1']);
  });
});
