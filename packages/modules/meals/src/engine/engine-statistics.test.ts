import { describe, expect, it } from 'vitest';
import { addDays, createSeededRng, diffDays } from '@almanac/core';
import type { Rng } from '@almanac/core';
import type { Recipe } from '@almanac/food';
import type { PlanItem, Settings, WeekPlan } from './types.js';
import { draw } from './draw.js';
import { generateWeek } from './generate-week.js';
import { commitWeek } from './commit-week.js';

// §12 statistical / anti-pattern suite. The principle under test (§6.6):
// clustering and predictability are different problems — a soft recency
// penalty plus a probabilistic draw must produce weight-proportional variety,
// honour cooldowns, and never collapse into a fixed rotation.

// 2026-07-06 is a Monday.
const MONDAY = '2026-07-06';

function item(recipeId: string, overrides: Partial<PlanItem> = {}): PlanItem {
  return { recipeId, weight: 1, cooldownDays: null, enabled: true, lastServed: null, ...overrides };
}

function recipe(id: string, tags: string[] = []): [string, Recipe] {
  return [id, { id, name: `Recipe ${id}`, tags, ingredients: [], servings: 2 }];
}

const RECIPES = new Map(
  ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'].map((id) => recipe(id)),
);

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    defaultCooldown: 0,
    variety: 0.25, // temperature = 0.45 + 0.25 * 2.2 = 1: weights pass through
    noWeekRepeat: false,
    avoidSameTag: false,
    weekStart: MONDAY,
    ...overrides,
  };
}

/** Generate → commit `weeks` times; returns every committed week in order. */
function runWeeks(
  startItems: PlanItem[],
  config: Settings,
  rng: Rng,
  weeks: number,
): WeekPlan[] {
  let items = startItems;
  let current = config;
  const plans: WeekPlan[] = [];
  for (let w = 0; w < weeks; w++) {
    const plan = generateWeek(items, RECIPES, current, [], rng);
    plans.push(plan);
    const committed = commitWeek(items, plan);
    items = committed.items;
    current = { ...current, weekStart: committed.nextWeekStart ?? current.weekStart };
  }
  return plans;
}

function counts(plans: WeekPlan[]): Map<string, number> {
  const tally = new Map<string, number>();
  for (const plan of plans) {
    for (const entry of plan) {
      if (entry.recipeId !== null) tally.set(entry.recipeId, (tally.get(entry.recipeId) ?? 0) + 1);
    }
  }
  return tally;
}

function entropyBits(tally: ReadonlyMap<string, number>): number {
  const total = [...tally.values()].reduce((a, b) => a + b, 0);
  let h = 0;
  for (const n of tally.values()) {
    const p = n / total;
    h -= p * Math.log2(p);
  }
  return h;
}

describe('(a) empirical frequency ≈ proportional to weights', () => {
  it('draw() itself is proportional (the roulette is not argmax)', () => {
    const candidates = [
      { id: 'a', name: 'a', fFreq: 1, fRec: 1, fTag: 1, daysSince: null, samplingWeight: 0.4 },
      { id: 'b', name: 'b', fFreq: 1, fRec: 1, fTag: 1, daysSince: null, samplingWeight: 1 },
      { id: 'c', name: 'c', fFreq: 1, fRec: 1, fTag: 1, daysSince: null, samplingWeight: 3.5 },
    ];
    const rng = createSeededRng(2026);
    const tally = new Map<string, number>();
    const draws = 20_000;
    for (let i = 0; i < draws; i++) {
      const pick = draw(candidates, rng)?.pick.id ?? '';
      tally.set(pick, (tally.get(pick) ?? 0) + 1);
    }
    const total = 0.4 + 1 + 3.5;
    expect((tally.get('a') ?? 0) / draws).toBeCloseTo(0.4 / total, 1);
    expect((tally.get('b') ?? 0) / draws).toBeCloseTo(1 / total, 1);
    expect((tally.get('c') ?? 0) / draws).toBeCloseTo(3.5 / total, 1);
  });

  it('over 300 committed weeks, serving counts order by weight and spread well beyond noise', () => {
    const items = [
      item('r1', { weight: 0.4 }),
      item('r2', { weight: 1 }),
      item('r3', { weight: 2 }),
      item('r4', { weight: 3.5 }),
    ];
    const tally = counts(runWeeks(items, settings(), createSeededRng(7), 300));
    const rare = tally.get('r1') ?? 0;
    const normal = tally.get('r2') ?? 0;
    const often = tally.get('r3') ?? 0;
    const favourite = tally.get('r4') ?? 0;
    expect(favourite).toBeGreaterThan(often);
    expect(often).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(rare);
    // The recency penalty compresses the raw 3.5/0.4 ratio; it must stay >> 1.
    expect(favourite / rare).toBeGreaterThan(2);
  });
});

describe('(b) cooldown is honoured across committed weeks', () => {
  it('minimum gap between repeats ≥ cooldown', () => {
    const items = [...RECIPES.keys()].map((id) => item(id));
    const plans = runWeeks(
      items,
      settings({ defaultCooldown: 3, noWeekRepeat: true }),
      createSeededRng(11),
      100,
    );
    const served = new Map<string, string[]>();
    for (const plan of plans) {
      for (const entry of plan) {
        if (entry.recipeId === null) continue;
        const dates = served.get(entry.recipeId) ?? [];
        dates.push(entry.date);
        served.set(entry.recipeId, dates);
      }
    }
    expect(served.size).toBeGreaterThan(0);
    for (const dates of served.values()) {
      for (let i = 1; i < dates.length; i++) {
        expect(diffDays(dates[i - 1] ?? '', dates[i] ?? '')).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('(c) the sequence is not periodic', () => {
  it('two seeds branching from the same history differ in ≥1 slot (high probability)', () => {
    // Build shared history first, then branch.
    const items = [...RECIPES.keys()].map((id) => item(id));
    const warmup = runWeeks(items, settings(), createSeededRng(1), 4);
    let history = items;
    for (const plan of warmup) history = commitWeek(history, plan).items;

    let differing = 0;
    for (let trial = 0; trial < 20; trial++) {
      const a = generateWeek(history, RECIPES, settings(), [], createSeededRng(1000 + trial));
      const b = generateWeek(history, RECIPES, settings(), [], createSeededRng(5000 + trial));
      if (a.some((entry, i) => entry.recipeId !== b[i]?.recipeId)) differing += 1;
    }
    expect(differing).toBeGreaterThanOrEqual(18);
  });

  it('conditional entropy of "next given previous" is far from zero (no fixed rotation)', () => {
    const items = [...RECIPES.keys()].map((id) => item(id));
    const plans = runWeeks(items, settings(), createSeededRng(21), 400);
    const transitions = new Map<string, Map<string, number>>();
    for (const plan of plans) {
      for (let i = 1; i < plan.length; i++) {
        const prev = plan[i - 1]?.recipeId;
        const next = plan[i]?.recipeId;
        if (prev == null || next == null) continue;
        const row = transitions.get(prev) ?? new Map<string, number>();
        row.set(next, (row.get(next) ?? 0) + 1);
        transitions.set(prev, row);
      }
    }
    // H(next | previous), weighted by how often each previous occurs. A fixed
    // rotation ("next" a function of "previous") would be exactly 0 bits.
    let total = 0;
    let weighted = 0;
    for (const row of transitions.values()) {
      const n = [...row.values()].reduce((a, b) => a + b, 0);
      total += n;
      weighted += n * entropyBits(row);
    }
    expect(weighted / total).toBeGreaterThan(0.5);
  });
});

describe('(d) the variety slider is real', () => {
  it('lower variety measurably increases predictability of the next pick', () => {
    // Recent, staggered history (1..8 days ago) so the recency factor actually
    // separates the candidates — that separation is what low variety sharpens.
    const items = [...RECIPES.keys()].map((id, i) =>
      item(id, { lastServed: addDays('2026-07-05', -i) }),
    );
    const mondayEntropy = (variety: number): number => {
      const tally = new Map<string, number>();
      for (let seed = 0; seed < 300; seed++) {
        const plan = generateWeek(items, RECIPES, settings({ variety }), [], createSeededRng(seed));
        const id = plan[0]?.recipeId;
        if (id != null) tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      return entropyBits(tally);
    };
    expect(mondayEntropy(0.05)).toBeLessThan(mondayEntropy(0.95));
  });
});

describe('degradation ladders under pressure (§12)', () => {
  it('3 meals + noWeekRepeat still fills all 7 days', () => {
    const items = [item('r1'), item('r2'), item('r3')];
    const plan = generateWeek(items, RECIPES, settings({ noWeekRepeat: true }), [], createSeededRng(2));
    expect(plan.every((entry) => entry.recipeId !== null)).toBe(true);
  });

  it('everything on a long cooldown still fills', () => {
    const items = [...RECIPES.keys()].map((id) => item(id, { lastServed: '2026-07-05' }));
    const plan = generateWeek(
      items, RECIPES, settings({ defaultCooldown: 30, noWeekRepeat: true }), [], createSeededRng(3),
    );
    expect(plan.every((entry) => entry.recipeId !== null)).toBe(true);
  });

  it('zero enabled meals ⇒ a week of null slots, no crash', () => {
    const items = [...RECIPES.keys()].map((id) => item(id, { enabled: false }));
    const plan = generateWeek(items, RECIPES, settings(), [], createSeededRng(4));
    expect(plan).toHaveLength(7);
    expect(plan.every((entry) => entry.recipeId === null && entry.breakdown === null)).toBe(true);
  });
});
