import type { MealsDaySlice } from '@almanac/meals';

/** One planned meal on a day: which slot it fills and which recipe. */
export interface DayMealEntry {
  slotId: string;
  recipeId: string;
}

/**
 * Every planned meal on a day, ordered by the configured slots (slot ids the
 * config doesn't know trail in slice order, so nothing planned is ever hidden).
 * Defensive: an absent or malformed slice contributes nothing, never throws (L5).
 */
export function dayMealEntries(
  slice: MealsDaySlice | undefined,
  slotOrder: ReadonlyArray<string> = [],
): DayMealEntry[] {
  const slots = slice?.slots;
  if (typeof slots !== 'object' || slots === null) return [];
  const ordered = [
    ...slotOrder.filter((id) => id in slots),
    ...Object.keys(slots).filter((id) => !slotOrder.includes(id)),
  ];
  return ordered.flatMap((slotId) => {
    const recipeId = slots[slotId]?.recipeId ?? null;
    return recipeId === null ? [] : [{ slotId, recipeId }];
  });
}

/**
 * Every planned recipe id on a day (across all meal slots), in slot order.
 * Defensive: an absent or malformed slice contributes nothing, never throws (L5).
 */
export function dayRecipeIds(slice: MealsDaySlice | undefined): string[] {
  return dayMealEntries(slice).map((entry) => entry.recipeId);
}
