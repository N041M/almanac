import { useMemo } from 'react';
import { getSlice, type ISODate } from '@almanac/core';
import { MEALS_NAMESPACE, type MealsDaySlice } from '@almanac/meals';
import type { DayOccurrence } from '@almanac/tasks';
import { useTranslation } from 'react-i18next';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { useTasks } from '../state/tasks';

/**
 * The grids' view of module day-contributions: a meal chip per date (from
 * the calendar's Day records), open task titles (entity records expanded by
 * range), and the drop handler that moves an entry between days. Absent
 * module data ⇒ nothing, quietly (L5).
 */
export function useDayChips(dates: ReadonlyArray<ISODate>): {
  chipFor: (date: ISODate) => string | undefined;
  tasksFor: (date: ISODate) => string[];
  onDropEntry: (from: ISODate, to: ISODate) => void;
} {
  const { t } = useTranslation('meals');
  const days = useCalendar((s) => s.days);
  const loaded = useMeals((s) => s.loaded);
  const recipes = useMeals((s) => s.recipes);
  const moveMeal = useMeals((s) => s.moveMeal);
  const occurrences = useTasks((s) => s.occurrences);
  // Subscribed so the grids re-render when items change.
  const items = useTasks((s) => s.items);

  // One occurrence expansion for the whole visible range, not one per cell.
  const first = dates[0];
  const last = dates[dates.length - 1];
  const taskMap = useMemo(
    () =>
      first === undefined || last === undefined
        ? new Map<ISODate, DayOccurrence[]>()
        : occurrences(first, last),
    [occurrences, first, last, items],
  );

  return {
    chipFor: (date) => {
      const day = days[date];
      if (day === undefined || !loaded) return undefined;
      const recipeId = getSlice<MealsDaySlice>(day, MEALS_NAMESPACE)?.recipeId;
      if (recipeId == null) return undefined;
      return recipes[recipeId]?.name ?? t('removedMeal');
    },
    tasksFor: (date) =>
      (taskMap.get(date) ?? [])
        .filter((o) => !(o.item.kind === 'task' && o.item.doneAt !== null))
        .map((o) => o.changes?.title ?? o.item.title),
    onDropEntry: (from, to) => void moveMeal(from, to),
  };
}
