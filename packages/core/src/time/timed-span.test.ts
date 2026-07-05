import { describe, expect, it } from 'vitest';
import {
  dateInZone,
  daysCovered,
  isValidTimeZone,
  resolveDisplayZone,
  type TimedSpan,
} from './timed-span.js';

// 2026-07-06T22:30:00Z — 00:30 July 7 in Prague (UTC+2), 18:30 July 6 in New York.
const LATE_UTC = Date.UTC(2026, 6, 6, 22, 30);

describe('dateInZone (5.2)', () => {
  it('the same instant falls on different calendar dates per zone', () => {
    expect(dateInZone(LATE_UTC, 'UTC')).toBe('2026-07-06');
    expect(dateInZone(LATE_UTC, 'Europe/Prague')).toBe('2026-07-07');
    expect(dateInZone(LATE_UTC, 'America/New_York')).toBe('2026-07-06');
  });

  it('a bad zone degrades to UTC; a non-finite instant to null (L5)', () => {
    expect(dateInZone(LATE_UTC, 'Not/AZone')).toBe('2026-07-06');
    expect(dateInZone(Number.NaN, 'UTC')).toBeNull();
  });
});

describe('resolveDisplayZone (5.2) — the L5 fallback chain', () => {
  it('event zone → viewer zone → UTC', () => {
    expect(resolveDisplayZone('Europe/Prague', 'America/New_York')).toBe('Europe/Prague');
    expect(resolveDisplayZone('Not/AZone', 'America/New_York')).toBe('America/New_York');
    expect(resolveDisplayZone(undefined, 'America/New_York')).toBe('America/New_York');
    expect(resolveDisplayZone('Not/AZone', 'Also/Bad')).toBe('UTC');
  });

  it('isValidTimeZone distinguishes real IANA ids', () => {
    expect(isValidTimeZone('Europe/Prague')).toBe(true);
    expect(isValidTimeZone('Gotham/BatCave')).toBe(false);
  });
});

describe('daysCovered (5.2)', () => {
  const at = (d: number, h: number, m = 0) => Date.UTC(2026, 6, d, h, m);

  it('a same-day event covers one date', () => {
    const span: TimedSpan = { startUtc: at(6, 9), endUtc: at(6, 10), zone: 'UTC' };
    expect(daysCovered(span, 'UTC')).toEqual(['2026-07-06']);
  });

  it('a multi-day span contributes to every day it touches', () => {
    const span: TimedSpan = { startUtc: at(6, 15), endUtc: at(9, 11), zone: 'UTC' };
    expect(daysCovered(span, 'UTC')).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
    ]);
  });

  it('day membership follows the display zone (the instant never changes)', () => {
    // 22:30–23:30 UTC on July 6 = 00:30–01:30 July 7 in Prague.
    const span: TimedSpan = { startUtc: at(6, 22, 30), endUtc: at(6, 23, 30), zone: 'Europe/Prague' };
    expect(daysCovered(span, 'Europe/Prague')).toEqual(['2026-07-07']);
    // Viewer chooses to see it in UTC instead: same event, July 6.
    expect(daysCovered({ ...span, zone: 'bogus' }, 'UTC')).toEqual(['2026-07-06']);
  });

  it('ending exactly at midnight does not occupy the next day', () => {
    const span: TimedSpan = { startUtc: at(6, 20), endUtc: at(7, 0), zone: 'UTC' };
    expect(daysCovered(span, 'UTC')).toEqual(['2026-07-06']);
  });

  it('end before start degrades to the start date alone — flagged, never dropped (L5)', () => {
    const span: TimedSpan = { startUtc: at(8, 10), endUtc: at(6, 10), zone: 'UTC' };
    expect(daysCovered(span, 'UTC')).toEqual(['2026-07-08']);
  });

  it('non-finite instants yield [], never a throw (L5)', () => {
    const span: TimedSpan = { startUtc: Number.NaN, endUtc: 0, zone: 'UTC' };
    expect(daysCovered(span, 'UTC')).toEqual([]);
  });
});
