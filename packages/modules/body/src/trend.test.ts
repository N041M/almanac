import { describe, expect, it } from 'vitest';
import { createDayStore, createMemoryStorage } from '@almanac/core';
import { bodyDayCodec } from './slice.js';
import { weeklyRateKg, weightTrend, type WeightEntry } from './trend.js';
import { createBodyStore } from './store.js';

/** Daily entries from a start date: weights[i] on start+i. */
function daily(start: string, weights: number[]): WeightEntry[] {
  return weights.map((weightKg, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), weightKg };
  });
}

describe('weight trend (the smoothed line is the signal, not the scale)', () => {
  it('smooths daily noise toward the trend', () => {
    const points = weightTrend(daily('2026-07-01', [80, 82, 78, 81]));
    expect(points.map((p) => p.trendKg.toFixed(2))).toEqual(['80.00', '80.20', '79.98', '80.08']);
  });

  it('tolerates unsorted input and gaps; empty in ⇒ empty out (L5)', () => {
    const scrambled = [
      { date: '2026-07-10', weightKg: 79 },
      { date: '2026-07-01', weightKg: 80 },
    ];
    expect(weightTrend(scrambled).map((p) => p.date)).toEqual(['2026-07-01', '2026-07-10']);
    expect(weightTrend([])).toEqual([]);
  });

  it('measures the weekly rate from the trend over the window', () => {
    // Steadily −0.1 kg/day for 28 days ⇒ the trend settles into a loss.
    const weights = Array.from({ length: 28 }, (_, i) => 80 - i * 0.1);
    const rate = weeklyRateKg(weightTrend(daily('2026-06-01', weights)));
    expect(rate).not.toBeNull();
    expect(rate ?? 0).toBeLessThan(-0.4); // ≈ −0.7 kg/week, damped by smoothing
    expect(rate ?? 0).toBeGreaterThan(-0.7);
  });

  it('offers no rate on thin history — a claim needs a span (L5)', () => {
    expect(weeklyRateKg(weightTrend([]))).toBeNull();
    expect(weeklyRateKg(weightTrend(daily('2026-07-01', [80])))).toBeNull();
    // Two points three days apart: under the minimum span.
    expect(
      weeklyRateKg(
        weightTrend([
          { date: '2026-07-01', weightKg: 80 },
          { date: '2026-07-04', weightKg: 79 },
        ]),
      ),
    ).toBeNull();
  });
});

describe('body slice + store', () => {
  it('implausible values read as not-logged, never an error (L5)', () => {
    expect(bodyDayCodec.decode({ weightKg: 5, bodyFatPct: 120 })).toEqual({
      weightKg: null,
      bodyFatPct: null,
    });
    expect(bodyDayCodec.decode({ weightKg: '80' })).toEqual({ weightKg: null, bodyFatPct: null });
    expect(bodyDayCodec.decode({ weightKg: 80.4, bodyFatPct: 22 })).toEqual({
      weightKg: 80.4,
      bodyFatPct: 22,
    });
  });

  it('round-trips logged days and reads the range back for the trend', async () => {
    const storage = createMemoryStorage();
    const store = createBodyStore(createDayStore(storage));
    await store.writeDay('2026-07-01', { weightKg: 80.5, bodyFatPct: null });
    await store.writeDay('2026-07-02', { weightKg: null, bodyFatPct: 21 });
    const days = await store.readLoggedDays('2026-06-01', '2026-07-31');
    expect([...days.entries()]).toEqual([
      ['2026-07-01', { weightKg: 80.5, bodyFatPct: null }],
      ['2026-07-02', { weightKg: null, bodyFatPct: 21 }],
    ]);
  });
});
