import { describe, it, expect } from 'vitest';
import { buildWeek, buildMonthGrid, intensityForPriority, normalizePriority } from './index.js';

describe('priority intensity scale', () => {
  it('maps priority to a consistent intensity; absent → full (L5)', () => {
    expect(intensityForPriority(1)).toBe(1);
    expect(intensityForPriority(2)).toBe(0.7);
    expect(intensityForPriority(3)).toBe(0.4);
    expect(intensityForPriority(undefined)).toBe(1);
  });

  it('numbered priority is unbounded, and the fade is capped so it stays legible (D9)', () => {
    // Beyond P3 the fade would run past the floor — it clamps instead.
    expect(intensityForPriority(4)).toBe(0.4);
    expect(intensityForPriority(10)).toBe(0.4);
    // Malformed values degrade to full intensity, never NaN (L5).
    expect(intensityForPriority(Number.NaN)).toBe(1);
    expect(intensityForPriority(0)).toBe(1);
  });

  it('normalizePriority keeps positive integers and rejects the rest', () => {
    expect(normalizePriority(5)).toBe(5);
    expect(normalizePriority(2.7)).toBe(2);
    expect(normalizePriority(0)).toBeUndefined();
    expect(normalizePriority(-1)).toBeUndefined();
    expect(normalizePriority('3')).toBeUndefined();
    expect(normalizePriority(Number.NaN)).toBeUndefined();
  });
});

describe('calendar model', () => {
  it('builds a 7-day week from the locale week-start', () => {
    // 2026-07-01 is a Wednesday.
    expect(buildWeek('2026-07-01', 1)).toEqual([
      '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02',
      '2026-07-03', '2026-07-04', '2026-07-05',
    ]);
    expect(buildWeek('2026-07-01', 0)[0]).toBe('2026-06-28'); // Sunday start
  });

  it('builds a month grid aligned to week-start, flagging in/out-of-month + today', () => {
    // July 2026: 1st is Wed; Monday-start grid begins Mon 2026-06-29.
    const grid = buildMonthGrid(2026, 7, 1, '2026-07-15');
    expect(grid[0]?.[0]?.date).toBe('2026-06-29');
    expect(grid[0]?.[0]?.inMonth).toBe(false); // June lead-in
    expect(grid[0]?.[2]?.date).toBe('2026-07-01');
    expect(grid[0]?.[2]?.inMonth).toBe(true);
    // every row has 7 cells; today is flagged exactly once
    expect(grid.every((row) => row.length === 7)).toBe(true);
    const todays = grid.flat().filter((c) => c.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0]?.date).toBe('2026-07-15');
  });

  it('grid covers the whole month', () => {
    const grid = buildMonthGrid(2026, 2, 1); // Feb 2026 (28 days)
    const inMonth = grid.flat().filter((c) => c.inMonth).map((c) => c.date);
    expect(inMonth[0]).toBe('2026-02-01');
    expect(inMonth[inMonth.length - 1]).toBe('2026-02-28');
    expect(inMonth).toHaveLength(28);
  });
});
