import { useMemo } from 'react';
import { getSlice, type ISODate } from '@almanac/core';
import { MEALS_NAMESPACE, type MealsDaySlice } from '@almanac/meals';
import type { DayOccurrence } from '@almanac/tasks';
import { useTranslation } from 'react-i18next';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { useTasks } from '../state/tasks';
import { useSubscriptions } from '../state/subscriptions';
import { useModuleVisible } from '../state/module-visibility';
import { feedOccurrences } from '../state/feed-occurrences';
import { viewerZone } from '../state/viewer-zone';
import { dayMealEntries } from '../state/meals-day';

/**
 * The grids' view of module day-contributions: the meal chips per date in
 * slot order (from the calendar's Day records), open task titles (entity
 * records expanded by range), and the drop handler that moves an entry
 * between days. Absent module data ⇒ nothing, quietly (L5).
 */
export function useDayChips(dates: ReadonlyArray<ISODate>): {
  chipsFor: (date: ISODate) => string[];
  tasksFor: (date: ISODate) => string[];
  onDropEntry: (from: ISODate, to: ISODate) => void;
} {
  const { t } = useTranslation('meals');
  const days = useCalendar((s) => s.days);
  const loaded = useMeals((s) => s.loaded);
  const recipes = useMeals((s) => s.recipes);
  const slots = useMeals((s) => s.slots);
  const moveMeal = useMeals((s) => s.moveMeal);
  const occurrences = useTasks((s) => s.occurrences);
  // Subscribed so the grids re-render when items change.
  const items = useTasks((s) => s.items);
  // Subscribed so feed events appear once a subscription refreshes.
  const feeds = useSubscriptions((s) => s.feeds);
  // A hidden module contributes nothing to the grids — same as absent (L5).
  const mealsVisible = useModuleVisible('meals');
  const tasksVisible = useModuleVisible('tasks');

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
  const feedMap = useMemo(
    () =>
      first === undefined || last === undefined
        ? new Map<ISODate, string[]>()
        : feedOccurrences(
            feeds.flatMap((f) => f.events),
            first,
            last,
            viewerZone,
          ),
    [feeds, first, last],
  );

  return {
    chipsFor: (date) => {
      const day = days[date];
      if (day === undefined || !loaded || !mealsVisible) return [];
      return dayMealEntries(
        getSlice<MealsDaySlice>(day, MEALS_NAMESPACE),
        slots.map((slot) => slot.id),
      ).map(({ recipeId }) => recipes[recipeId]?.name ?? t('removedMeal'));
    },
    tasksFor: (date) => [
      ...(tasksVisible
        ? (taskMap.get(date) ?? [])
            .filter((o) => !(o.item.kind === 'task' && o.item.doneAt !== null))
            .map((o) => o.changes?.title ?? o.item.title)
        : []),
      // Read-only subscription events share the same compact chip line (L5:
      // absent/failed feeds contribute nothing, quietly).
      ...(feedMap.get(date) ?? []),
    ],
    onDropEntry: (from, to) => void moveMeal(from, to),
  };
}
