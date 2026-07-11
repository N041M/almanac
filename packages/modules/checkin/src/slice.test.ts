import { describe, expect, it } from 'vitest';
import { createDayStore, createMemoryStorage, getSlice } from '@almanac/core';
import { checkinDayCodec, hasCheckin, CHECKIN_NAMESPACE } from './slice.js';
import { createCheckinStore } from './store.js';

const EMPTY = { mood: null, energy: null, symptoms: [], note: '' };

describe('checkin slice codec (L5 degradation)', () => {
  it('decodes a full payload', () => {
    expect(
      checkinDayCodec.decode({ mood: 4, energy: 2, symptoms: ['headache'], note: 'long day' }),
    ).toEqual({ mood: 4, energy: 2, symptoms: ['headache'], note: 'long day' });
  });

  it('reads out-of-scale or non-integer ratings as not-logged, never an error', () => {
    expect(checkinDayCodec.decode({ mood: 0, energy: 6 })).toEqual(EMPTY);
    expect(checkinDayCodec.decode({ mood: 3.5, energy: 'high' })).toEqual(EMPTY);
  });

  it('drops malformed symptom entries but keeps the rest', () => {
    expect(checkinDayCodec.decode({ symptoms: ['cramps', 7, '', null, 'nausea'] })).toEqual({
      ...EMPTY,
      symptoms: ['cramps', 'nausea'],
    });
  });

  it('an absent field is the ordinary not-logged state', () => {
    expect(checkinDayCodec.decode({})).toEqual(EMPTY);
  });

  it('hasCheckin is false for the empty/absent slice and true for any logged field', () => {
    expect(hasCheckin(undefined)).toBe(false);
    expect(hasCheckin(EMPTY)).toBe(false);
    expect(hasCheckin({ ...EMPTY, mood: 3 })).toBe(true);
    expect(hasCheckin({ ...EMPTY, symptoms: ['headache'] })).toBe(true);
    expect(hasCheckin({ ...EMPTY, note: 'x' })).toBe(true);
  });
});

describe('checkin store — the day slice is the only state (§11)', () => {
  it('round-trips a day and reads absent days as the empty slice', async () => {
    const storage = createMemoryStorage();
    const store = createCheckinStore(createDayStore(storage));
    expect(await store.readDay('2026-07-11')).toEqual(EMPTY);

    const logged = { mood: 5, energy: 3, symptoms: ['headache'], note: '' };
    await store.writeDay('2026-07-11', logged);
    expect(await store.readDay('2026-07-11')).toEqual(logged);
  });

  it('a corrupt slice degrades to the default in isolation (L5)', async () => {
    const storage = createMemoryStorage();
    const dayStore = createDayStore(storage);
    const store = createCheckinStore(dayStore);
    await store.writeDay('2026-07-11', { ...EMPTY, mood: 2 });

    // Corrupt only this slice's stored value, then read through the day store.
    const keys = await storage.keys();
    const key = keys.find((k) => k.includes(CHECKIN_NAMESPACE));
    expect(key).toBeDefined();
    await storage.write(key ?? '', '{ not json');
    expect(await store.readDay('2026-07-11')).toEqual(EMPTY);

    // The day record itself still reads; the slice just defaults.
    const day = await dayStore.getDay('2026-07-11', [checkinDayCodec]);
    expect(getSlice(day, CHECKIN_NAMESPACE)).toEqual(EMPTY);
  });
});
