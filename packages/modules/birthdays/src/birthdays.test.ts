import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '@almanac/core';
import { ageOn, birthdaysOn, fallsOn, isValidCalendarDay, type Birthday } from './birthdays.js';
import { createBirthdaysStore } from './store.js';

const ANNA: Birthday = { id: 'a', name: 'Anna', month: 7, day: 12, year: 1994 };
const LEAP: Birthday = { id: 'l', name: 'Leo', month: 2, day: 29, year: 2000 };
const NO_YEAR: Birthday = { id: 'n', name: 'Nia', month: 7, day: 12, year: null };

describe('yearly occurrence (§8)', () => {
  it('falls on the month/day every year; age from the known year', () => {
    expect(fallsOn(ANNA, '2026-07-12')).toBe(true);
    expect(fallsOn(ANNA, '2031-07-12')).toBe(true);
    expect(fallsOn(ANNA, '2026-07-13')).toBe(false);
    expect(ageOn(ANNA, '2026-07-12')).toBe(32);
    expect(ageOn(NO_YEAR, '2026-07-12')).toBeNull();
  });

  it('Feb 29 celebrates on Feb 28 off-leap-years, Feb 29 on leap years', () => {
    expect(fallsOn(LEAP, '2028-02-29')).toBe(true);
    expect(fallsOn(LEAP, '2027-02-28')).toBe(true);
    expect(fallsOn(LEAP, '2028-02-28')).toBe(false); // leap year: the 29th owns it
    expect(fallsOn(LEAP, '2027-03-01')).toBe(false);
  });

  it('collects a date’s birthdays in name order', () => {
    expect(birthdaysOn([NO_YEAR, ANNA, LEAP], '2026-07-12').map((b) => b.name)).toEqual([
      'Anna',
      'Nia',
    ]);
  });

  it('rejects impossible calendar days at the seam', () => {
    expect(isValidCalendarDay(2, 29)).toBe(true); // valid as a birthday (leap-born)
    expect(isValidCalendarDay(2, 30)).toBe(false);
    expect(isValidCalendarDay(4, 31)).toBe(false);
    expect(isValidCalendarDay(13, 1)).toBe(false);
  });
});

describe('birthdays store', () => {
  it('round-trips entries; a malformed entry costs only itself (L5)', async () => {
    const storage = createMemoryStorage();
    const store = createBirthdaysStore(storage);
    expect(await store.getEntries()).toEqual([]);
    await store.saveEntries([ANNA, LEAP]);
    expect(await store.getEntries()).toEqual([ANNA, LEAP]);

    await storage.write(
      'birthdays:entries',
      JSON.stringify({
        v: 1,
        d: [ANNA, { id: 'bad', name: '', month: 2, day: 30 }, 'junk', LEAP],
      }),
    );
    expect(await store.getEntries()).toEqual([ANNA, LEAP]);
  });

  it('corrupt or unknown-version payloads degrade to empty', async () => {
    const storage = createMemoryStorage();
    const store = createBirthdaysStore(storage);
    await storage.write('birthdays:entries', '{ not json');
    expect(await store.getEntries()).toEqual([]);
    await storage.write('birthdays:entries', JSON.stringify({ v: 99, d: [ANNA] }));
    expect(await store.getEntries()).toEqual([]);
  });
});
