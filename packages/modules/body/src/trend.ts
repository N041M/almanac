import { diffDays, type ISODate } from '@almanac/core';

// Tuning values (§8, exported per the constants convention).
/**
 * Exponential smoothing per logged entry — the classic weight-trend recipe:
 * daily weight noise (water, food timing) swings ~±1 kg, so the trend, not
 * the scale reading, is the number worth watching.
 */
export const TREND_SMOOTHING = 0.1;
/** The window the weekly rate is measured over. */
export const RATE_WINDOW_DAYS = 28;
/** Rate needs at least this span of trend to say anything (L5: else null). */
export const MIN_RATE_SPAN_DAYS = 7;

export interface WeightEntry {
  date: ISODate;
  weightKg: number;
}

export interface TrendPoint {
  date: ISODate;
  weightKg: number;
  trendKg: number;
}

/**
 * The smoothed trend series, in date order. Unsorted input is fine; the first
 * entry seeds the trend. Gaps don't break anything — each logged day nudges
 * the trend a step toward the reading (L5: no data ⇒ an empty series).
 */
export function weightTrend(entries: ReadonlyArray<WeightEntry>): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const points: TrendPoint[] = [];
  let trend: number | null = null;
  for (const { date, weightKg } of sorted) {
    trend = trend === null ? weightKg : trend + TREND_SMOOTHING * (weightKg - trend);
    points.push({ date, weightKg, trendKg: trend });
  }
  return points;
}

/**
 * The recent weekly rate of change, from the trend (never raw readings):
 * latest trend vs. the trend at the start of the window, scaled to a week.
 * Null when the history can't carry a rate — fewer than two points in the
 * window or too short a span (L5: no claim beats a noisy one).
 */
export function weeklyRateKg(
  points: ReadonlyArray<TrendPoint>,
  windowDays: number = RATE_WINDOW_DAYS,
): number | null {
  const last = points[points.length - 1];
  if (last === undefined) return null;
  const windowPoints = points.filter((p) => diffDays(p.date, last.date) <= windowDays);
  const first = windowPoints[0];
  if (first === undefined || first === last) return null;
  const span = diffDays(first.date, last.date);
  if (span < MIN_RATE_SPAN_DAYS) return null;
  return ((last.trendKg - first.trendKg) / span) * 7;
}
