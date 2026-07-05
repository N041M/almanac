import { useTranslation } from 'react-i18next';
import { addDays, bcp47, dateFromISO, getSlice, type ISODate } from '@almanac/core';
import { MEALS_NAMESPACE, type MealsDaySlice } from '@almanac/meals';
import { DAY_MARK_NAMESPACE, type DayMark } from '../state/day-mark';
import { AGENDA_DAYS, useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { useTasks } from '../state/tasks';

/**
 * The flat upcoming list (5.4): every day in the window with any module
 * contribution, read from the shared day records. No entries at all is the
 * most common state and stays actionable, never blank (L5).
 */
export function AgendaView({ start }: { start: ISODate }) {
  const { t } = useTranslation();
  const locale = useCalendar((s) => s.locale);
  const days = useCalendar((s) => s.days);
  const select = useCalendar((s) => s.select);
  const setView = useCalendar((s) => s.setView);
  const recipes = useMeals((s) => s.recipes);

  const dayFormat = new Intl.DateTimeFormat(bcp47(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  const occurrences = useTasks((s) => s.occurrences);
  useTasks((s) => s.items); // re-render on task changes
  const taskMap = occurrences(start, addDays(start, AGENDA_DAYS - 1));

  const rows = Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(start, i))
    .map((date) => {
      const day = days[date];
      const meal = day === undefined ? undefined : getSlice<MealsDaySlice>(day, MEALS_NAMESPACE);
      const starred = day === undefined ? false : getSlice<DayMark>(day, DAY_MARK_NAMESPACE)?.starred === true;
      const mealName =
        meal?.recipeId == null
          ? undefined
          : (recipes[meal.recipeId]?.name ?? t('meals:removedMeal'));
      const tasks = (taskMap.get(date) ?? [])
        .filter((o) => !(o.item.kind === 'task' && o.item.doneAt !== null))
        .map((o) => o.changes?.title ?? o.item.title);
      return { date, mealName, starred, tasks };
    })
    .filter((row) => row.mealName !== undefined || row.starred || row.tasks.length > 0);

  if (rows.length === 0) {
    return <p className="px-2 py-4 text-sm text-ink-muted">{t('agendaEmpty')}</p>;
  }

  return (
    <ol className="divide-y divide-line">
      {rows.map(({ date, mealName, starred, tasks }) => (
        <li key={date}>
          <button
            type="button"
            onClick={() => {
              select(date);
              setView('day');
            }}
            className="flex w-full items-baseline gap-3 px-2 py-2.5 text-left hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="w-44 shrink-0 text-sm capitalize text-ink-muted">
              {dayFormat.format(dateFromISO(date))}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {tasks.map((title) => (
                <span key={title} className="mr-3">
                  • {title}
                </span>
              ))}
              {mealName !== undefined && (
                <>
                  <span className="text-ink-muted">{t('meals:plannedMeal')}: </span>
                  {mealName}
                </>
              )}
              {starred && (
                <span aria-label={t('starredLegend')} className="ml-2 text-mark">
                  ★
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
