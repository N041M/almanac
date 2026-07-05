import { describe, expect, it } from 'vitest';
import type { StoragePort } from '@almanac/core';

/**
 * The `StoragePort` contract as one reusable suite (roadmap 5.5): every
 * adapter — memory, localStorage, SQLite, and any future one (Expo, P11) —
 * must pass these before it ships. The rule: **a port gets its contract
 * suite before it gains its next implementation.**
 */
export function describeStoragePortContract(
  name: string,
  make: () => StoragePort | Promise<StoragePort>,
): void {
  describe(`StoragePort contract: ${name}`, () => {
    it('round-trips values and reads absent keys as null', async () => {
      const port = await make();
      expect(await port.read('contract:absent')).toBeNull();
      await port.write('contract:a', 'value-1');
      expect(await port.read('contract:a')).toBe('value-1');
    });

    it('overwrites on repeated writes and preserves empty-string values', async () => {
      const port = await make();
      await port.write('contract:a', 'first');
      await port.write('contract:a', 'second');
      expect(await port.read('contract:a')).toBe('second');
      await port.write('contract:empty', '');
      expect(await port.read('contract:empty')).toBe('');
    });

    it('remove deletes exactly the given key', async () => {
      const port = await make();
      await port.write('contract:a', '1');
      await port.write('contract:b', '2');
      await port.remove('contract:a');
      expect(await port.read('contract:a')).toBeNull();
      expect(await port.read('contract:b')).toBe('2');
    });

    it('keys() lists everything; keys(prefix) filters literally', async () => {
      const port = await make();
      await port.write('contract:day:1', 'a');
      await port.write('contract:day:2', 'b');
      await port.write('contract:other', 'c');
      expect((await port.keys('contract:day:')).sort()).toEqual([
        'contract:day:1',
        'contract:day:2',
      ]);
      expect((await port.keys()).length).toBeGreaterThanOrEqual(3);
      // Wildcard characters in a prefix are literals, never patterns.
      await port.write('contract:a%b', 'wild');
      await port.write('contract:axb', 'plain');
      expect(await port.keys('contract:a%b')).toEqual(['contract:a%b']);
    });

    it('readMany (when present) aligns with keys, including duplicates and gaps', async () => {
      const port = await make();
      if (port.readMany === undefined) return; // optional per the contract (L5)
      await port.write('contract:x', '1');
      await port.write('contract:z', '3');
      expect(await port.readMany(['contract:x', 'contract:y', 'contract:z', 'contract:x'])).toEqual(
        ['1', null, '3', '1'],
      );
      expect(await port.readMany([])).toEqual([]);
    });
  });
}
