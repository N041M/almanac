import type { ISODate } from '@almanac/core';
import { addDays, diffDays } from '@almanac/core';
import type { PlanItem, WeekPlan } from './types.js';

export interface CommitResult {
  items: PlanItem[];
  /** `weekStart` advanced by 7 — the caller writes it into `Settings`. */
  nextWeekStart: ISODate | null;
}

/**
 * §6.5 `commitWeek` — **the only writer of history**: each used recipe's
 * `lastServed` becomes its latest date in the plan; `weekStart` advances by 7.
 * Pure: returns new items + the next week start, the caller persists both.
 */
export function commitWeek(items: ReadonlyArray<PlanItem>, plan: WeekPlan): CommitResult {
  const latest = new Map<string, ISODate>();
  for (const entry of plan) {
    if (entry.recipeId === null) continue;
    const seen = latest.get(entry.recipeId);
    if (seen === undefined || diffDays(seen, entry.date) > 0) {
      latest.set(entry.recipeId, entry.date);
    }
  }

  const first = plan[0];
  return {
    items: items.map((item) => {
      const served = latest.get(item.recipeId);
      return served === undefined ? item : { ...item, lastServed: served };
    }),
    nextWeekStart: first === undefined ? null : addDays(first.date, 7),
  };
}
