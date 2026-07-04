import type { ISODate, Rng } from '@almanac/core';
import type { Recipe } from '@almanac/food';
import type { PlanItem, Settings, WeekPlan } from './types.js';
import { selectSlot } from './select-slot.js';

/**
 * §6.5 `rerollDay` — re-pick one slot against the other six days + committed
 * history, excluding the current pick when alternatives exist. Same ladder as
 * generation. A locked or out-of-range index returns the plan unchanged
 * (quietly, L5); an unfillable slot becomes `recipeId: null`.
 */
export function rerollDay(
  items: ReadonlyArray<PlanItem>,
  recipes: ReadonlyMap<string, Recipe>,
  settings: Settings,
  plan: WeekPlan,
  index: number,
  rng: Rng,
): WeekPlan {
  const entry = plan[index];
  if (entry === undefined || entry.locked) return plan;

  const working = new Map<string, ISODate>();
  for (const item of items) {
    if (item.lastServed !== null) working.set(item.recipeId, item.lastServed);
  }
  const used = new Set<string>();
  plan.forEach((other, i) => {
    if (i === index || other.recipeId === null) return;
    working.set(other.recipeId, other.date);
    used.add(other.recipeId);
  });

  const previous = plan[index - 1];
  const previousDayTags = new Set(
    previous?.recipeId != null ? (recipes.get(previous.recipeId)?.tags ?? []) : [],
  );

  const selected = selectSlot(
    items,
    recipes,
    entry.date,
    working,
    used,
    previousDayTags,
    settings,
    rng,
    entry.recipeId ?? undefined,
  );

  return plan.map((e, i) =>
    i === index
      ? {
          ...e,
          recipeId: selected?.recipeId ?? null,
          locked: false,
          breakdown: selected?.breakdown ?? null,
        }
      : e,
  );
}
