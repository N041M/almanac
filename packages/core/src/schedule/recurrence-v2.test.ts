import { describe, expect, it } from 'vitest';
import { occurrencesInRange, type Recurrence } from './recurrence.js';
import { applyOverrides, type InstanceOverride } from './overrides.js';

describe('recurrence v2 — yearly (5.1)', () => {
  it('fires on the start month+day every year, honouring interval', () => {
    const rule: Recurrence = { freq: 'yearly', start: '2024-07-15' };
    expect(occurrencesInRange(rule, '2024-01-01', '2027-12-31')).toEqual([
      '2024-07-15',
      '2025-07-15',
      '2026-07-15',
      '2027-07-15',
    ]);
    expect(
      occurrencesInRange({ ...rule, interval: 2 }, '2024-01-01', '2027-12-31'),
    ).toEqual(['2024-07-15', '2026-07-15']);
  });

  it('a Feb-29 start skips non-leap years, quietly (L5)', () => {
    const rule: Recurrence = { freq: 'yearly', start: '2024-02-29' };
    expect(occurrencesInRange(rule, '2024-01-01', '2029-12-31')).toEqual([
      '2024-02-29',
      '2028-02-29',
    ]);
  });
});

describe('recurrence v2 — byWeekdayPos (5.1)', () => {
  it('nth weekday of the month: 2nd Tuesday', () => {
    const rule: Recurrence = {
      freq: 'monthly',
      start: '2026-01-01',
      byWeekdayPos: { weekday: 2, nth: 2 },
    };
    expect(occurrencesInRange(rule, '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-13',
      '2026-02-10',
      '2026-03-10',
    ]);
  });

  it('-1 = the last such weekday of the month', () => {
    const rule: Recurrence = {
      freq: 'monthly',
      start: '2026-01-01',
      byWeekdayPos: { weekday: 5, nth: -1 }, // last Friday
    };
    expect(occurrencesInRange(rule, '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-30',
      '2026-02-27',
      '2026-03-27',
    ]);
  });

  it('a 5th weekday only fires in months that have one (skip, not shift)', () => {
    const rule: Recurrence = {
      freq: 'monthly',
      start: '2026-01-01',
      byWeekdayPos: { weekday: 5, nth: 5 }, // 5th Friday
    };
    // 2026: Jan 30 is a 5th Friday; Feb–Apr have only four Fridays; May 29 is 5th.
    expect(occurrencesInRange(rule, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-30',
      '2026-05-29',
    ]);
  });
});

describe('recurrence v2 — exDates (5.1)', () => {
  it('removes exactly the excluded occurrence', () => {
    const rule: Recurrence = {
      freq: 'weekly',
      start: '2026-07-06',
      exDates: ['2026-07-13'],
    };
    expect(occurrencesInRange(rule, '2026-07-01', '2026-07-27')).toEqual([
      '2026-07-06',
      '2026-07-20',
      '2026-07-27',
    ]);
  });

  it('excluded dates still consume count (delete ≠ extend the series)', () => {
    const rule: Recurrence = {
      freq: 'daily',
      start: '2026-07-06',
      count: 3,
      exDates: ['2026-07-07'],
    };
    expect(occurrencesInRange(rule, '2026-07-01', '2026-07-31')).toEqual([
      '2026-07-06',
      '2026-07-08',
    ]);
  });

  it('malformed exDate entries are ignored, never invalidating the rule (L5)', () => {
    const rule: Recurrence = {
      freq: 'daily',
      start: '2026-07-06',
      exDates: ['garbage', '2026-02-30', '2026-07-07'],
    };
    expect(occurrencesInRange(rule, '2026-07-06', '2026-07-08')).toEqual([
      '2026-07-06',
      '2026-07-08',
    ]);
  });
});

describe('instance overrides (5.1) — the series-vs-instance contract', () => {
  const dates = ['2026-07-06', '2026-07-13', '2026-07-20'];
  type Changes = { title?: string };

  it('cancelled disappears; changes ride along; untouched instances pass through', () => {
    const overrides: InstanceOverride<Changes>[] = [
      { seriesId: 's', occurrenceDate: '2026-07-13', changes: 'cancelled' },
      { seriesId: 's', occurrenceDate: '2026-07-20', changes: { title: 'Moved room' } },
    ];
    expect(applyOverrides<Changes>(dates, overrides)).toEqual([
      { date: '2026-07-06' },
      { date: '2026-07-20', changes: { title: 'Moved room' } },
    ]);
  });

  it('an override referencing a non-occurrence is inert (L5)', () => {
    const overrides: InstanceOverride<Changes>[] = [
      { seriesId: 's', occurrenceDate: '2026-07-14', changes: 'cancelled' },
    ];
    expect(applyOverrides(dates, overrides)).toEqual(dates.map((date) => ({ date })));
  });

  it('a corrupt override record is skipped; the base series renders intact (L5)', () => {
    const corrupt = [
      null,
      42,
      { seriesId: 's' },
      { seriesId: 's', occurrenceDate: 'not-a-date', changes: 'cancelled' },
    ] as unknown as InstanceOverride[];
    expect(applyOverrides(dates, corrupt)).toEqual(dates.map((date) => ({ date })));
  });
});
