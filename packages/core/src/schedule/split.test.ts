import { describe, expect, it } from 'vitest';
import { splitSeries } from './split.js';
import { occurrencesInRange, type Recurrence } from './recurrence.js';

const weekly: Recurrence = { freq: 'weekly', start: '2026-07-06' }; // Mondays

describe('splitSeries — "this and following" (P6)', () => {
  it('caps the original and starts the successor at the split date', () => {
    const { before, after } = splitSeries(weekly, '2026-07-20');
    expect(before?.until).toBe('2026-07-19');
    expect(after.start).toBe('2026-07-20');
    // No occurrence is lost or duplicated across the cut.
    const range: [string, string] = ['2026-07-06', '2026-08-03'];
    const all = occurrencesInRange(weekly, ...range);
    const rejoined = [
      ...(before === null ? [] : occurrencesInRange(before, ...range)),
      ...occurrencesInRange(after, ...range),
    ];
    expect(rejoined).toEqual(all);
  });

  it('partitions count by consumption', () => {
    const counted: Recurrence = { ...weekly, count: 5 };
    const { before, after } = splitSeries(counted, '2026-07-20');
    expect(before?.count).toBe(2); // Jul 6, 13
    expect(after.count).toBe(3); // Jul 20, 27, Aug 3
  });

  it('sends exDates to the side they fall on', () => {
    const withEx: Recurrence = { ...weekly, exDates: ['2026-07-13', '2026-07-27'] };
    const { before, after } = splitSeries(withEx, '2026-07-20');
    expect(before?.exDates).toEqual(['2026-07-13']);
    expect(after.exDates).toEqual(['2026-07-27']);
  });

  it('splitting at or before the start is a no-split: the series stays intact (L5)', () => {
    expect(splitSeries(weekly, '2026-07-06')).toEqual({ before: null, after: weekly });
    expect(splitSeries(weekly, '2026-01-01')).toEqual({ before: null, after: weekly });
    expect(splitSeries(weekly, 'garbage')).toEqual({ before: null, after: weekly });
  });

  it('preserves nth-weekday patterns across the cut', () => {
    const secondTuesday: Recurrence = {
      freq: 'monthly',
      start: '2026-01-01',
      byWeekdayPos: { weekday: 2, nth: 2 },
    };
    const { after } = splitSeries(secondTuesday, '2026-03-10');
    expect(occurrencesInRange(after, '2026-03-01', '2026-05-31')).toEqual([
      '2026-03-10',
      '2026-04-14',
      '2026-05-12',
    ]);
  });
});
