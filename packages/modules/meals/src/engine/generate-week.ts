import type { ISODate, Rng } from '@almanac/core';
import { addDays, weekdayOf } from '@almanac/core';
import type { Recipe } from '@almanac/food';
import type { PlanEntry, PlanItem, Settings, WeekPlan } from './types.js';
import { selectSlot } from './select-slot.js';

/** Weekday keys by `weekdayOf` index (0 = Sunday) — views translate (L7). */
const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export function dayNameOf(date: ISODate): string {
  return DAY_NAMES[weekdayOf(date)];
}

/** Tags of the entry's recipe; empty for null slots or a missing recipe (L5). */
function tagsOf(
  entry: PlanEntry | undefined,
  recipes: ReadonlyMap<string, Recipe>,
): ReadonlySet<string> {
  if (entry?.recipeId == null) return new Set();
  return new Set(recipes.get(entry.recipeId)?.tags ?? []);
}

/**
 * §6.5 `generateWeek`. History = `lastServed` only — the visible plan is never
 * folded back in, so re-generating never penalises itself. Pass 1 places
 * locked days (kept verbatim from `prevPlan` by date); pass 2 fills the rest
 * Mon→Sun through gates → scorers → draw, relaxing per the ladder. Never
 * throws; an unfillable slot is `recipeId: null`.
 *
 * `recipes` carries the food attributes (§6 note: the engine reads tags from
 * the linked recipe); a missing recipe degrades to no tags, never a crash.
 */
export function generateWeek(
  items: ReadonlyArray<PlanItem>,
  recipes: ReadonlyMap<string, Recipe>,
  settings: Settings,
  prevPlan: WeekPlan,
  rng: Rng,
): WeekPlan {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(settings.weekStart, i));
  const working = new Map<string, ISODate>();
  for (const item of items) {
    if (item.lastServed !== null) working.set(item.recipeId, item.lastServed);
  }
  const used = new Set<string>();
  const plan: (PlanEntry | undefined)[] = new Array<PlanEntry | undefined>(7);

  // Pass 1 — locked days stand exactly as they are, and count as placed.
  const prevByDate = new Map(prevPlan.map((entry) => [entry.date, entry]));
  dates.forEach((date, i) => {
    const prev = prevByDate.get(date);
    if (prev === undefined || !prev.locked) return;
    plan[i] = { ...prev, dayName: dayNameOf(date) };
    if (prev.recipeId !== null) {
      working.set(prev.recipeId, date);
      used.add(prev.recipeId);
    }
  });

  // Pass 2 — fill the open days in order; yesterday's tags come from the plan
  // as it stands (locked or drawn alike).
  dates.forEach((date, i) => {
    if (plan[i] !== undefined) return;
    const previousDayTags = tagsOf(plan[i - 1], recipes);
    const selected = selectSlot(
      items,
      recipes,
      date,
      working,
      used,
      previousDayTags,
      settings,
      rng,
    );
    if (selected !== null) {
      working.set(selected.recipeId, date);
      used.add(selected.recipeId);
    }
    plan[i] = {
      dayName: dayNameOf(date),
      date,
      recipeId: selected?.recipeId ?? null,
      locked: false,
      breakdown: selected?.breakdown ?? null,
    };
  });

  return plan as WeekPlan;
}
