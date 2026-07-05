import { describe, expect, it } from 'vitest';
import { createSeededRng } from '@almanac/core';
import type { Recipe } from '@almanac/food';
import type { PlanItem, Settings, WeekPlan } from './types.js';
import { RECENCY_TAU, TAG_PENALTY } from './constants.js';
import { passesGates, daysSince, ALL_GATES } from './gates.js';
import { recencyFactor, tagFactor } from './scorers.js';
import { buildCandidates } from './candidates.js';
import { draw } from './draw.js';
import { selectSlot } from './select-slot.js';
import { generateWeek, dayNameOf } from './generate-week.js';
import { rerollDay } from './reroll-day.js';
import { commitWeek } from './commit-week.js';

// 2026-07-06 is a Monday.
const MONDAY = '2026-07-06';

function item(recipeId: string, overrides: Partial<PlanItem> = {}): PlanItem {
  return { recipeId, weight: 1, cooldownDays: null, enabled: true, lastServed: null, ...overrides };
}

function recipe(id: string, tags: string[] = []): [string, Recipe] {
  return [id, { id, name: `Recipe ${id}`, tags, ingredients: [], servings: 2 }];
}

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    defaultCooldown: 2,
    variety: 0.5,
    noWeekRepeat: true,
    avoidSameTag: true,
    weekStart: MONDAY,
    ...overrides,
  };
}

const RECIPES = new Map([
  recipe('pasta', ['italian']),
  recipe('pizza', ['italian']),
  recipe('goulash', ['czech']),
  recipe('curry', ['indian']),
  recipe('soup', ['czech']),
  recipe('salad', []),
  recipe('tacos', ['mexican']),
  recipe('risotto', ['italian']),
]);
const ALL_ITEMS = [...RECIPES.keys()].map((id) => item(id));

describe('scorers (§6.4)', () => {
  it('recencyFactor: never-served ⇒ 1; today ⇒ 0; recovers on the τ curve', () => {
    expect(recencyFactor(Infinity)).toBe(1);
    expect(recencyFactor(0)).toBe(0);
    expect(recencyFactor(RECENCY_TAU)).toBeCloseTo(1 - Math.exp(-1));
    expect(recencyFactor(3)).toBeLessThan(recencyFactor(10));
  });

  it('tagFactor: penalises only an actual overlap, and only when the setting is on', () => {
    const yesterday = new Set(['italian']);
    expect(tagFactor(['italian'], yesterday, true)).toBe(TAG_PENALTY);
    expect(tagFactor(['czech'], yesterday, true)).toBe(1);
    expect(tagFactor(['italian'], yesterday, false)).toBe(1);
    expect(tagFactor([], yesterday, true)).toBe(1);
  });
});

describe('gates (§6.3)', () => {
  const working = new Map([['pasta', '2026-07-05']]);

  it('disabled is excluded on every rung — never relaxed', () => {
    const disabled = item('pasta', { enabled: false });
    expect(passesGates(disabled, MONDAY, working, new Set(), settings(), ALL_GATES)).toBe(false);
    expect(
      passesGates(disabled, MONDAY, working, new Set(), settings(), {
        cooldown: false,
        weekRepeat: false,
      }),
    ).toBe(false);
  });

  it('cooldown: excludes d < cooldown, admits d ≥ cooldown, counts |d| (future too)', () => {
    const pasta = item('pasta'); // served 2026-07-05, default cooldown 2
    expect(passesGates(pasta, '2026-07-06', working, new Set(), settings(), ALL_GATES)).toBe(false);
    expect(passesGates(pasta, '2026-07-07', working, new Set(), settings(), ALL_GATES)).toBe(true);
    // slot *before* the working date, 1 day away: |d| = 1 < 2
    expect(passesGates(pasta, '2026-07-04', working, new Set(), settings(), ALL_GATES)).toBe(false);
  });

  it('per-item cooldownDays overrides the default; null uses it', () => {
    const strict = item('pasta', { cooldownDays: 5 });
    expect(passesGates(strict, '2026-07-08', working, new Set(), settings(), ALL_GATES)).toBe(false);
    expect(passesGates(strict, '2026-07-10', working, new Set(), settings(), ALL_GATES)).toBe(true);
  });

  it('week-repeat applies only when enabled in settings and by the rung', () => {
    const pasta = item('pasta');
    const used = new Set(['pasta']);
    const far = new Map([['pasta', '2026-06-01']]);
    expect(passesGates(pasta, MONDAY, far, used, settings(), ALL_GATES)).toBe(false);
    expect(passesGates(pasta, MONDAY, far, used, settings({ noWeekRepeat: false }), ALL_GATES)).toBe(true);
    expect(
      passesGates(pasta, MONDAY, far, used, settings(), { cooldown: true, weekRepeat: false }),
    ).toBe(true);
  });

  it('daysSince: |diff| from the working date, null when never served', () => {
    expect(daysSince(item('pasta'), '2026-07-08', working)).toBe(3);
    expect(daysSince(item('curry'), MONDAY, working)).toBeNull();
  });
});

describe('buildCandidates', () => {
  it('a missing linked recipe degrades: no tags, id as name, still plannable (L5)', () => {
    const rng = createSeededRng(1);
    const candidates = buildCandidates(
      [item('ghost')],
      RECIPES,
      MONDAY,
      new Map(),
      new Set(),
      new Set(['italian']),
      settings(),
      rng,
      ALL_GATES,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe('ghost');
    expect(candidates[0]?.fTag).toBe(1);
  });

  it('a zero weight floors at MIN_SCORE — still drawable, never a hard zero', () => {
    const rng = createSeededRng(1);
    const candidates = buildCandidates(
      [item('pasta', { weight: 0 })],
      RECIPES,
      MONDAY,
      new Map(),
      new Set(),
      new Set(),
      settings(),
      rng,
      ALL_GATES,
    );
    expect(candidates[0]?.samplingWeight).toBeGreaterThan(0);
  });

  it('is deterministic per seed (jitter comes from the injected rng, L4)', () => {
    const build = () =>
      buildCandidates(
        ALL_ITEMS,
        RECIPES,
        MONDAY,
        new Map(),
        new Set(),
        new Set(),
        settings(),
        createSeededRng(42),
        ALL_GATES,
      );
    expect(build()).toEqual(build());
  });
});

describe('draw (§6.5)', () => {
  const fixed = (id: string, samplingWeight: number) => ({
    id,
    name: id,
    fFreq: 1,
    fRec: 1,
    fTag: 1,
    daysSince: null,
    samplingWeight,
  });

  it('returns the pick plus the full distribution, which sums to 1', () => {
    const result = draw([fixed('a', 1), fixed('b', 3)], createSeededRng(7));
    expect(result).not.toBeNull();
    const sum = result?.distribution.reduce((s, d) => s + d.p, 0) ?? 0;
    expect(sum).toBeCloseTo(1);
    expect(result?.distribution.find((d) => d.id === 'b')?.p).toBeCloseTo(0.75);
  });

  it('excludeId drops the current pick — unless it is the only option', () => {
    const rng = createSeededRng(3);
    for (let i = 0; i < 20; i++) {
      expect(draw([fixed('a', 1), fixed('b', 1)], rng, 'a')?.pick.id).toBe('b');
    }
    expect(draw([fixed('a', 1)], rng, 'a')?.pick.id).toBe('a');
  });

  it('no candidates ⇒ null (the ladder handles it)', () => {
    expect(draw([], createSeededRng(1))).toBeNull();
  });
});

describe('selectSlot — the relaxation ladder (§6.5)', () => {
  it('all used this week + noWeekRepeat ⇒ drops week-repeat and still selects', () => {
    const used = new Set(RECIPES.keys());
    const selected = selectSlot(
      ALL_ITEMS, RECIPES, MONDAY, new Map(), used, new Set(), settings(), createSeededRng(1),
    );
    expect(selected).not.toBeNull();
  });

  it('everything on cooldown ⇒ drops cooldown and still selects', () => {
    const working = new Map([...RECIPES.keys()].map((id) => [id, '2026-07-05'] as const));
    const selected = selectSlot(
      ALL_ITEMS, RECIPES, MONDAY, working, new Set(), new Set(),
      settings({ defaultCooldown: 30 }), createSeededRng(1),
    );
    expect(selected).not.toBeNull();
  });

  it('zero enabled ⇒ null, quietly — the rung below the ladder', () => {
    const disabled = ALL_ITEMS.map((i) => ({ ...i, enabled: false }));
    const selected = selectSlot(
      disabled, RECIPES, MONDAY, new Map(), new Set(), new Set(), settings(), createSeededRng(1),
    );
    expect(selected).toBeNull();
  });

  it('records a full breakdown: probability, count, factors, sorted top alternatives', () => {
    const selected = selectSlot(
      ALL_ITEMS, RECIPES, MONDAY, new Map(), new Set(), new Set(), settings(), createSeededRng(9),
    );
    const b = selected?.breakdown;
    expect(b?.candidateCount).toBe(8);
    expect(b?.prob).toBeGreaterThan(0);
    expect(b?.daysSince).toBeNull();
    expect(b?.alternatives.length).toBe(3);
    const ps = b?.alternatives.map((a) => a.p) ?? [];
    expect([...ps].sort((x, y) => y - x)).toEqual(ps);
    expect(b?.alternatives.some((a) => a.id === selected?.recipeId)).toBe(false);
  });
});

describe('generateWeek (§6.5)', () => {
  it('fills Monday→Sunday with dates, day names, and breakdowns', () => {
    const plan = generateWeek(ALL_ITEMS, RECIPES, settings(), [], createSeededRng(11));
    expect(plan).toHaveLength(7);
    expect(plan[0]).toMatchObject({ date: MONDAY, dayName: 'monday', locked: false });
    expect(plan[6]).toMatchObject({ date: '2026-07-12', dayName: 'sunday' });
    for (const entry of plan) {
      expect(entry.recipeId).not.toBeNull();
      expect(entry.breakdown?.prob).toBeGreaterThan(0);
    }
  });

  it('is deterministic per seed; two seeds are allowed to differ', () => {
    const a = generateWeek(ALL_ITEMS, RECIPES, settings(), [], createSeededRng(5));
    const b = generateWeek(ALL_ITEMS, RECIPES, settings(), [], createSeededRng(5));
    expect(a).toEqual(b);
  });

  it('respects noWeekRepeat: seven distinct recipes', () => {
    const plan = generateWeek(ALL_ITEMS, RECIPES, settings(), [], createSeededRng(13));
    const ids = plan.map((e) => e.recipeId);
    expect(new Set(ids).size).toBe(7);
  });

  it('pass 1: locked days are kept verbatim and excluded from re-draw', () => {
    const locked: WeekPlan = generateWeek(ALL_ITEMS, RECIPES, settings(), [], createSeededRng(17))
      .map((e, i) => (i === 2 ? { ...e, locked: true } : e));
    const lockedEntry = locked[2];
    const plan = generateWeek(ALL_ITEMS, RECIPES, settings(), locked, createSeededRng(99));
    expect(plan[2]).toEqual(lockedEntry);
    // week-repeat: the locked recipe appears nowhere else
    expect(plan.filter((e) => e.recipeId === lockedEntry?.recipeId)).toHaveLength(1);
  });

  it("a locked day's tags penalise the next day (previousDayTags crosses passes)", () => {
    // Only two meals: lock 'pasta' (italian) on Monday; Tuesday's only candidate
    // under week-repeat is 'pizza' (also italian) → its fTag records the penalty.
    const items = [item('pasta'), item('pizza')];
    const prev: WeekPlan = generateWeek(items, RECIPES, settings({ defaultCooldown: 0 }), [], createSeededRng(1))
      .map((e, i) => (i === 0 ? { ...e, recipeId: 'pasta', locked: true } : e));
    const plan = generateWeek(items, RECIPES, settings({ defaultCooldown: 0 }), prev, createSeededRng(2));
    expect(plan[1]?.recipeId).toBe('pizza');
    expect(plan[1]?.breakdown?.fTag).toBe(TAG_PENALTY);
  });

  it('never mutates its inputs (pure, L4): items keep their history', () => {
    const items = [item('pasta', { lastServed: '2026-06-01' }), item('curry')];
    const before = structuredClone(items);
    generateWeek(items, RECIPES, settings(), [], createSeededRng(3));
    expect(items).toEqual(before);
  });

  it('cooldown respects committed history across the week boundary', () => {
    // Served the day before the week starts, cooldown 3: Mon/Tue blocked for it.
    const items = [item('pasta', { lastServed: '2026-07-05', cooldownDays: 3 }), item('curry'), item('soup')];
    const plan = generateWeek(items, RECIPES, settings({ noWeekRepeat: false }), [], createSeededRng(23));
    expect(plan[0]?.recipeId).not.toBe('pasta');
    expect(plan[1]?.recipeId).not.toBe('pasta');
  });
});

describe('rerollDay (§6.5)', () => {
  const basePlan = () => generateWeek(ALL_ITEMS, RECIPES, settings(), [], createSeededRng(31));

  it('changes the pick when alternatives exist and touches nothing else', () => {
    const plan = basePlan();
    const rerolled = rerollDay(ALL_ITEMS, RECIPES, settings(), plan, 3, createSeededRng(7));
    expect(rerolled[3]?.recipeId).not.toBe(plan[3]?.recipeId);
    rerolled.forEach((entry, i) => {
      if (i !== 3) expect(entry).toEqual(plan[i]);
    });
  });

  it('keeps the pick when it is the only option', () => {
    const only = [item('pasta')];
    const plan = generateWeek(only, RECIPES, settings({ noWeekRepeat: false, defaultCooldown: 0 }), [], createSeededRng(1));
    const rerolled = rerollDay(only, RECIPES, settings({ noWeekRepeat: false, defaultCooldown: 0 }), plan, 2, createSeededRng(2));
    expect(rerolled[2]?.recipeId).toBe('pasta');
  });

  it('a locked or out-of-range index returns the plan unchanged, quietly (L5)', () => {
    const plan = basePlan().map((e, i) => (i === 4 ? { ...e, locked: true } : e));
    expect(rerollDay(ALL_ITEMS, RECIPES, settings(), plan, 4, createSeededRng(1))).toBe(plan);
    expect(rerollDay(ALL_ITEMS, RECIPES, settings(), plan, 42, createSeededRng(1))).toBe(plan);
  });
});

describe('commitWeek (§6.5) — the only writer of history', () => {
  it('sets lastServed to the latest planned date per recipe and advances the week', () => {
    const plan = generateWeek(ALL_ITEMS, RECIPES, settings(), [], createSeededRng(37));
    const { items, nextWeekStart } = commitWeek(ALL_ITEMS, plan);
    for (const entry of plan) {
      expect(items.find((i) => i.recipeId === entry.recipeId)?.lastServed).toBe(entry.date);
    }
    expect(nextWeekStart).toBe('2026-07-13');
  });

  it('a recipe appearing twice gets its latest date', () => {
    const entry = (date: string, recipeId: string) => ({
      dayName: dayNameOf(date), date, recipeId, locked: false, breakdown: null,
    });
    const plan: WeekPlan = [entry(MONDAY, 'pasta'), entry('2026-07-09', 'pasta')];
    const { items } = commitWeek([item('pasta')], plan);
    expect(items[0]?.lastServed).toBe('2026-07-09');
  });

  it('unused recipes and null slots are untouched; inputs are not mutated', () => {
    const source = [item('pasta', { lastServed: '2026-05-01' })];
    const plan: WeekPlan = [
      { dayName: 'monday', date: MONDAY, recipeId: null, locked: false, breakdown: null },
    ];
    const { items } = commitWeek(source, plan);
    expect(items[0]?.lastServed).toBe('2026-05-01');
    expect(source[0]?.lastServed).toBe('2026-05-01');
  });

  it('an empty plan commits nothing', () => {
    const { items, nextWeekStart } = commitWeek(ALL_ITEMS, []);
    expect(items).toEqual(ALL_ITEMS);
    expect(nextWeekStart).toBeNull();
  });
});
