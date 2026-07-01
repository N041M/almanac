import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { buildMonthGrid, bcp47, intensityForPriority, type Weekday } from '@almanac/core';
import { useCalendar } from '../state/store';
import { today } from '../clock';

/** Localized short weekday labels, ordered from the locale's week-start. */
function weekdayLabels(localeTag: string, weekStartsOn: Weekday): string[] {
  const fmt = new Intl.DateTimeFormat(localeTag, { weekday: 'short' });
  const sunday = Date.UTC(2023, 0, 1); // 2023-01-01 is a Sunday
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(sunday + ((weekStartsOn + i) % 7) * 86_400_000)),
  );
}

export function MonthView() {
  const { t } = useTranslation();
  const year = useCalendar((s) => s.year);
  const month = useCalendar((s) => s.month);
  const locale = useCalendar((s) => s.locale);
  const selected = useCalendar((s) => s.selected);
  const starred = useCalendar((s) => s.starred);
  const prevMonth = useCalendar((s) => s.prevMonth);
  const nextMonth = useCalendar((s) => s.nextMonth);
  const goToday = useCalendar((s) => s.goToday);
  const select = useCalendar((s) => s.select);
  const loadMonth = useCalendar((s) => s.loadMonth);

  useEffect(() => {
    void loadMonth();
  }, [year, month, locale, loadMonth]);

  const tag = bcp47(locale);
  const grid = buildMonthGrid(year, month, locale.weekStartsOn, today());
  const title = new Intl.DateTimeFormat(tag, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <section aria-label="calendar" className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center justify-between">
        <button
          aria-label={t('prevMonth')}
          onClick={prevMonth}
          className="rounded px-2 py-1 hover:bg-neutral-200"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium capitalize">{title}</h2>
          <button onClick={goToday} className="rounded border px-2 py-0.5 text-xs">
            {t('today')}
          </button>
        </div>
        <button
          aria-label={t('nextMonth')}
          onClick={nextMonth}
          className="rounded px-2 py-1 hover:bg-neutral-200"
        >
          ›
        </button>
      </div>

      <div role="grid" aria-label={t('title')} className="grid grid-cols-7 gap-1 text-sm">
        {/* `contents` keeps rows in the ARIA tree without breaking the 7-col grid. */}
        <div role="row" className="contents">
          {weekdayLabels(tag, locale.weekStartsOn).map((label) => (
            <div
              key={label}
              role="columnheader"
              className="py-1 text-center text-xs font-medium text-neutral-500"
            >
              {label}
            </div>
          ))}
        </div>

        {grid.map((week, wi) => (
          <div key={week[0]?.date ?? String(wi)} role="row" className="contents">
            {week.map((cell) => {
              const isSelected = cell.date === selected;
              const isStarred = starred[cell.date] ?? false;
              return (
                <button
                  key={cell.date}
                  role="gridcell"
                  aria-label={cell.date}
                  aria-current={cell.isToday ? 'date' : undefined}
                  aria-selected={isSelected}
                  onClick={() => select(cell.date)}
                  className={[
                    'relative aspect-square rounded p-1 text-left align-top',
                    cell.inMonth ? 'text-neutral-900' : 'text-neutral-300',
                    cell.isToday ? 'ring-1 ring-blue-500' : '',
                    isSelected ? 'bg-blue-100' : 'hover:bg-neutral-100',
                  ].join(' ')}
                >
                  <span className="text-xs">{Number(cell.date.slice(8, 10))}</span>
                  {isStarred && (
                    <span
                      aria-label={t('starredLegend')}
                      className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-500"
                      style={{ opacity: intensityForPriority(1) }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
