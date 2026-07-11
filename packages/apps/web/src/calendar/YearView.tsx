import { useMemo } from 'react';
import {
  buildMonthGrid,
  bcp47,
  dateFromISO,
  getSlice,
  type ISODate,
} from '@almanac/core';
import { MEALS_NAMESPACE, type MealsDaySlice } from '@almanac/meals';
import { dayRecipeIds } from '../state/meals-day';
import { useCalendar } from '../state/store';
import { useSettings } from '../state/settings';
import { useModuleVisible } from '../state/module-visibility';
import { useTasks } from '../state/tasks';
import { DAY_MARK_NAMESPACE, type DayMark } from '../state/day-mark';
import { today } from '../clock';

/** Contribution count → one of four intensities (the year grid's density scale). */
function densityClass(count: number): string {
  if (count <= 0) return 'bg-transparent text-ink-faint';
  if (count === 1) return 'bg-accent-soft text-ink';
  if (count === 2) return 'bg-accent/40 text-ink';
  return 'bg-accent/70 text-accent-ink';
}

/**
 * The 12-month density grid (P8): a whole year at a glance, each day shaded by
 * how much it holds (meals, stars, task/event occurrences). Empty is the most
 * common state and renders fine (L5). Clicking a day zooms into its month.
 */
export function YearView({ year }: { year: number }) {
  const locale = useCalendar((s) => s.locale);
  const weekStartsOn = useSettings((s) => s.weekStartsOn) ?? locale.weekStartsOn;
  const days = useCalendar((s) => s.days);
  const select = useCalendar((s) => s.select);
  const setView = useCalendar((s) => s.setView);
  const occurrences = useTasks((s) => s.occurrences);
  const items = useTasks((s) => s.items);
  // Hidden modules add no density — the same posture as absent (L5).
  const mealsVisible = useModuleVisible('meals');
  const tasksVisible = useModuleVisible('tasks');
  const todayDate = today();
  const tag = bcp47(locale);

  const monthName = useMemo(
    () => new Intl.DateTimeFormat(tag, { month: 'long', timeZone: 'UTC' }),
    [tag],
  );

  // One density number per date: day-record contributions + task occurrences.
  const density = useMemo(() => {
    const map = new Map<ISODate, number>();
    const bump = (date: ISODate, n = 1): void => {
      if (n > 0) map.set(date, (map.get(date) ?? 0) + n);
    };
    for (const [date, day] of Object.entries(days)) {
      if (mealsVisible) bump(date, dayRecipeIds(getSlice<MealsDaySlice>(day, MEALS_NAMESPACE)).length);
      if (getSlice<DayMark>(day, DAY_MARK_NAMESPACE)?.starred === true) bump(date);
    }
    if (tasksVisible) {
      for (const [date, list] of occurrences(`${year}-01-01` as ISODate, `${year}-12-31` as ISODate)) {
        bump(date, list.filter((o) => !(o.item.kind === 'task' && o.item.doneAt !== null)).length);
      }
    }
    return map;
    // `items` is a dep so the grid re-densifies when tasks change.
  }, [days, occurrences, items, year, mealsVisible, tasksVisible]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map((month) => {
        const grid = buildMonthGrid(year, month, weekStartsOn, todayDate);
        return (
          <div key={month} className="rounded-xl border border-line p-2">
            <h3 className="mb-1 text-xs font-semibold capitalize text-ink-muted">
              {monthName.format(dateFromISO(`${year}-${String(month).padStart(2, '0')}-01`))}
            </h3>
            <div className="grid grid-cols-7 gap-0.5">
              {grid.flat().map((cell) => (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => {
                    select(cell.date);
                    setView('month');
                  }}
                  title={cell.date}
                  className={[
                    'aspect-square rounded-[3px] text-[9px] leading-none',
                    'focus-visible:outline-2 focus-visible:outline-accent',
                    cell.inMonth ? densityClass(density.get(cell.date) ?? 0) : 'text-transparent',
                    cell.isToday ? 'ring-1 ring-accent' : '',
                  ].join(' ')}
                >
                  {cell.inMonth ? Number(cell.date.slice(8, 10)) : ''}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
