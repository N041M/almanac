import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  buildMonthGrid,
  buildWeek,
  bcp47,
  dateFromISO,
  MS_PER_DAY,
  type ISODate,
  type Weekday,
} from '@almanac/core';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { Button } from '../ui/Button';
import { ViewSwitcher } from './ViewSwitcher';
import { MonthGrid } from './MonthGrid';
import { WeekGrid } from './WeekGrid';
import { DayDetail } from './DayDetail';
import { today } from '../clock';

/** Localized short weekday labels, ordered from the locale's week-start. */
function weekdayLabels(fmt: Intl.DateTimeFormat, weekStartsOn: Weekday): string[] {
  const sunday = Date.UTC(2023, 0, 1); // 2023-01-01 is a Sunday
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(sunday + ((weekStartsOn + i) % 7) * MS_PER_DAY)),
  );
}

/** The local date, kept current across midnight while the app stays open. */
function useToday(): ISODate {
  const [value, setValue] = useState(today);
  useEffect(() => {
    const id = setInterval(() => {
      const now = today();
      setValue((prev) => (prev === now ? prev : now));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return value;
}

const ARROW_DELTAS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export function CalendarView() {
  const { t } = useTranslation();
  const view = useCalendar((s) => s.view);
  const anchor = useCalendar((s) => s.anchor);
  const locale = useCalendar((s) => s.locale);
  const selected = useCalendar((s) => s.selected);
  const prev = useCalendar((s) => s.prev);
  const next = useCalendar((s) => s.next);
  const goToday = useCalendar((s) => s.goToday);
  const select = useCalendar((s) => s.select);
  const loadRange = useCalendar((s) => s.loadRange);

  const tag = bcp47(locale);
  // Intl formatter construction is costly; rebuild only when the locale changes.
  const formatters = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }),
      month: new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      range: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
      full: new Intl.DateTimeFormat(tag, { dateStyle: 'full', timeZone: 'UTC' }),
    }),
    [tag],
  );
  const labels = weekdayLabels(formatters.weekday, locale.weekStartsOn);
  const cellLabel = (date: string): string => formatters.full.format(dateFromISO(date));

  const todayDate = useToday();
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const grid = useMemo(
    () => buildMonthGrid(year, month, locale.weekStartsOn, todayDate),
    [year, month, locale.weekStartsOn, todayDate],
  );
  const week = useMemo(
    () => buildWeek(anchor, locale.weekStartsOn),
    [anchor, locale.weekStartsOn],
  );
  const shownDay = selected ?? anchor;

  // The visible range, per view — drives slice loading.
  const lastRow = grid[grid.length - 1];
  const [first, last]: [ISODate | undefined, ISODate | undefined] =
    view === 'month'
      ? [grid[0]?.[0]?.date, lastRow?.[lastRow.length - 1]?.date]
      : view === 'week'
        ? [week[0], week[6]]
        : [shownDay, shownDay];
  useEffect(() => {
    if (first !== undefined && last !== undefined) void loadRange(first, last);
  }, [first, last, loadRange]);

  const title =
    view === 'month'
      ? formatters.month.format(dateFromISO(`${anchor.slice(0, 7)}-01`))
      : view === 'week' && first !== undefined && last !== undefined
        ? formatters.range.formatRange(dateFromISO(first), dateFromISO(last))
        : formatters.full.format(dateFromISO(shownDay));

  // Roving selection: the grid is one tab stop; arrows move the selected day
  // (aria-activedescendant), crossing range edges as needed. ⌘C/⌘V copy and
  // paste the selected day's entry (meals today; tasks join at Phase 6).
  const copyMeal = useMeals((s) => s.copyMeal);
  const pasteMeal = useMeals((s) => s.pasteMeal);
  function onGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if ((e.metaKey || e.ctrlKey) && selected !== null) {
      const key = e.key.toLowerCase(); // Shift/CapsLock must not break the chord
      if (key === 'c') {
        e.preventDefault();
        copyMeal(selected);
        return;
      }
      if (key === 'v') {
        e.preventDefault();
        void pasteMeal(selected);
        return;
      }
    }
    const delta = ARROW_DELTAS[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    select(selected === null ? todayDate : addDays(selected, delta));
  }

  return (
    <section aria-label={t('title')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" aria-label={t('prev')} onClick={prev}>
            ‹
          </Button>
          <Button variant="ghost" aria-label={t('next')} onClick={next}>
            ›
          </Button>
          <Button onClick={goToday}>{t('today')}</Button>
        </div>
        <h2 className="text-base font-semibold capitalize">{title}</h2>
        <ViewSwitcher />
      </div>

      {view === 'month' && (
        <MonthGrid
          grid={grid}
          weekdayLabels={labels}
          cellLabel={cellLabel}
          gridLabel={title}
          onKeyDown={onGridKeyDown}
        />
      )}
      {view === 'week' && (
        <WeekGrid
          days={week}
          todayDate={todayDate}
          weekdayLabels={labels}
          cellLabel={cellLabel}
          gridLabel={title}
          onKeyDown={onGridKeyDown}
        />
      )}
      {view === 'day' && <DayDetail date={shownDay} heading={false} />}
    </section>
  );
}
