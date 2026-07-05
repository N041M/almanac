import { describe, it, expect } from 'vitest';
import { occurrencesInRange, type Recurrence } from './index.js';

describe('occurrencesInRange', () => {
  it('daily with interval', () => {
    const rule: Recurrence = { freq: 'daily', start: '2026-07-01', interval: 2 };
    expect(occurrencesInRange(rule, '2026-07-01', '2026-07-07')).toEqual([
      '2026-07-01',
      '2026-07-03',
      '2026-07-05',
      '2026-07-07',
    ]);
  });

  it('weekly on specific weekdays (every Sat = 6)', () => {
    // "shopping every Saturday" (§8.1)
    const rule: Recurrence = { freq: 'weekly', start: '2026-07-01', byWeekday: [6] };
    expect(occurrencesInRange(rule, '2026-07-01', '2026-07-31')).toEqual([
      '2026-07-04',
      '2026-07-11',
      '2026-07-18',
      '2026-07-25',
    ]);
  });

  it('bi-weekly respects the interval blocks', () => {
    const rule: Recurrence = {
      freq: 'weekly',
      start: '2026-07-01', // Wed; week block anchored Monday 2026-06-29
      interval: 2,
      byWeekday: [3], // Wednesday
    };
    expect(occurrencesInRange(rule, '2026-07-01', '2026-08-01')).toEqual([
      '2026-07-01',
      '2026-07-15',
      '2026-07-29',
    ]);
  });

  it('monthly on the same day, skipping months without it', () => {
    const rule: Recurrence = { freq: 'monthly', start: '2026-01-31' };
    expect(occurrencesInRange(rule, '2026-01-01', '2026-05-01')).toEqual([
      '2026-01-31',
      '2026-03-31', // Feb + Apr skipped (no 31st)
    ]);
  });

  it('honours count even when the window opens later', () => {
    const rule: Recurrence = { freq: 'daily', start: '2026-07-01', count: 3 };
    // Only 3 occurrences ever: Jul 1,2,3. A later window sees none of them.
    expect(occurrencesInRange(rule, '2026-07-02', '2026-07-10')).toEqual(['2026-07-02', '2026-07-03']);
    expect(occurrencesInRange(rule, '2026-07-05', '2026-07-10')).toEqual([]);
  });

  it('honours until', () => {
    const rule: Recurrence = { freq: 'daily', start: '2026-07-01', until: '2026-07-03' };
    expect(occurrencesInRange(rule, '2026-07-01', '2026-07-31')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ]);
  });

  it('empty/backwards range yields nothing', () => {
    const rule: Recurrence = { freq: 'daily', start: '2026-07-01' };
    expect(occurrencesInRange(rule, '2026-07-10', '2026-07-01')).toEqual([]);
  });

  it('malformed dates degrade to [] instead of throwing (L5)', () => {
    const rule: Recurrence = { freq: 'daily', start: 'garbage' };
    expect(occurrencesInRange(rule, '2026-07-01', '2026-07-10')).toEqual([]);
    const ok: Recurrence = { freq: 'daily', start: '2026-07-01', until: '2026-02-30' };
    expect(occurrencesInRange(ok, '2026-07-01', '2026-07-10')).toEqual([]);
    expect(occurrencesInRange({ freq: 'daily', start: '2026-07-01' }, 'nope', '2026-07-10')).toEqual([]);
  });

  it('a rule started years earlier stays correct when the walk skips to the window', () => {
    // bi-weekly Wednesdays anchored in 2020; phase must survive the cursor jump
    const rule: Recurrence = {
      freq: 'weekly',
      start: '2020-01-01', // a Wednesday
      interval: 2,
      byWeekday: [3],
    };
    expect(occurrencesInRange(rule, '2026-07-01', '2026-07-31')).toEqual([
      '2026-07-08',
      '2026-07-22',
    ]);
  });
});
