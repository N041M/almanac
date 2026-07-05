import { describe, it, expect } from 'vitest';
import { getSlice } from './day.js';
import type { Day } from './day.js';
import type { SliceCodec } from './slice-codec.js';
import type { StoragePort } from '../ports/storage.js';
import { createDayStore } from './day-store.js';
import { createMemoryStorage } from './memory-storage.js';
import { createFixedClock } from '../time/fixed-clock.js';

/** The same storage without its batch read — exercises the fallback path. */
function withoutReadMany(storage: StoragePort): StoragePort {
  return {
    read: (key) => storage.read(key),
    write: (key, value) => storage.write(key, value),
    remove: (key) => storage.remove(key),
    keys: (prefix) => storage.keys(prefix),
  };
}

/** `getSlice` over a possibly-absent Day (range indexing under strict TS). */
function sliceOf<T>(day: Day | undefined, namespace: string): T | undefined {
  return day === undefined ? undefined : getSlice<T>(day, namespace);
}

interface Mood {
  energy: number;
}

const moodCodec: SliceCodec<Mood> = {
  namespace: 'checkin',
  version: 1,
  default: () => ({ energy: 0 }),
  decode: (raw) => {
    if (typeof raw !== 'object' || raw === null || typeof (raw as Mood).energy !== 'number') {
      throw new Error('bad mood slice');
    }
    return raw as Mood;
  },
  encode: (value) => value,
};

const tasksCodec: SliceCodec<string[]> = {
  namespace: 'tasks',
  version: 1,
  default: () => [],
  decode: (raw) => {
    if (!Array.isArray(raw)) throw new Error('bad tasks slice');
    return raw as string[];
  },
  encode: (value) => value,
};

describe('DayStore', () => {
  it('round-trips a slice and returns defaults for unwritten ones (sparse, L5)', async () => {
    const store = createDayStore(createMemoryStorage());
    expect(await store.readSlice('2026-07-01', moodCodec)).toEqual({ energy: 0 });

    await store.writeSlice('2026-07-01', moodCodec, { energy: 4 });
    expect(await store.readSlice('2026-07-01', moodCodec)).toEqual({ energy: 4 });

    const day = await store.getDay('2026-07-01', [moodCodec, tasksCodec]);
    expect(getSlice<Mood>(day, 'checkin')).toEqual({ energy: 4 });
    expect(getSlice<string[]>(day, 'tasks')).toEqual([]); // never written → default
  });

  it('isolates a corrupt slice: it degrades to default, neighbours are fine', async () => {
    const storage = createMemoryStorage({
      // hand-written corrupt payload for one slice
      'day:2026-07-01:checkin': '{"v":1,"d":{"energy":"not-a-number"}}',
    });
    const store = createDayStore(storage);
    await store.writeSlice('2026-07-01', tasksCodec, ['buy milk']);

    const day = await store.getDay('2026-07-01', [moodCodec, tasksCodec]);
    expect(getSlice<Mood>(day, 'checkin')).toEqual({ energy: 0 }); // corrupt → default
    expect(getSlice<string[]>(day, 'tasks')).toEqual(['buy milk']); // unaffected
  });

  it('falls back to default on an unknown stored version', async () => {
    const storage = createMemoryStorage({
      'day:2026-07-01:tasks': '{"v":99,"d":["stale"]}',
    });
    const store = createDayStore(storage);
    expect(await store.readSlice('2026-07-01', tasksCodec)).toEqual([]);
  });

  it('reads an inclusive date range — identically via batch and fallback paths', async () => {
    const storage = createMemoryStorage();
    await createDayStore(storage).writeSlice('2026-07-02', tasksCodec, ['batch me']);

    for (const port of [storage, withoutReadMany(storage)]) {
      const days = await createDayStore(port).getRange('2026-07-01', '2026-07-03', [
        moodCodec,
        tasksCodec,
      ]);
      expect(days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
      expect(sliceOf<string[]>(days[1], 'tasks')).toEqual(['batch me']);
      expect(sliceOf<Mood>(days[0], 'checkin')).toEqual({ energy: 0 });
    }
  });

  it('a corrupt slice inside a batched range still degrades in isolation (L5)', async () => {
    const storage = createMemoryStorage({
      'day:2026-07-02:checkin': 'not even json',
    });
    const store = createDayStore(storage);
    await store.writeSlice('2026-07-02', tasksCodec, ['fine']);
    const days = await store.getRange('2026-07-02', '2026-07-02', [moodCodec, tasksCodec]);
    expect(sliceOf<Mood>(days[0], 'checkin')).toEqual({ energy: 0 });
    expect(sliceOf<string[]>(days[0], 'tasks')).toEqual(['fine']);
  });

  it('stamps writes with modified-at when a clock is injected (sync-ready, D4)', async () => {
    const storage = createMemoryStorage();
    const clocked = createDayStore(storage, createFixedClock(1_750_000_000_000));
    await clocked.writeSlice('2026-07-01', moodCodec, { energy: 3 });
    const raw = await storage.read('day:2026-07-01:checkin');
    expect(JSON.parse(raw ?? '{}')).toEqual({
      v: 1,
      d: { energy: 3 },
      m: 1_750_000_000_000,
    });

    // No clock → no timestamp; both shapes read back fine.
    const unclocked = createDayStore(storage);
    await unclocked.writeSlice('2026-07-02', moodCodec, { energy: 5 });
    const raw2 = await storage.read('day:2026-07-02:checkin');
    expect(JSON.parse(raw2 ?? '{}')).toEqual({ v: 1, d: { energy: 5 } });
    expect(await clocked.readSlice('2026-07-02', moodCodec)).toEqual({ energy: 5 });
    expect(await unclocked.readSlice('2026-07-01', moodCodec)).toEqual({ energy: 3 });
  });
});
