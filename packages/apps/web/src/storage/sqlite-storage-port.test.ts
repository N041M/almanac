import { describe, expect, it } from 'vitest';
import { createSqliteStoragePort, READ_MANY_CHUNK } from './sqlite-storage-port';
import { fakeDb } from './sqlite-fake';

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
