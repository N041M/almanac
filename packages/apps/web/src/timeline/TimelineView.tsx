import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO, type ISODate } from '@almanac/core';
import { useCalendar } from '../state/store';
import { useSettings } from '../state/settings';
import { useDayChips } from '../calendar/use-day-chips';

/**
 * The hour-grid week view (5.4): time-axis rows with an all-day lane on top.
 * Today the all-day lane carries the day-record contributions (meals, drag &
 * drop included); the hour area is the ready surface timed events render into
 * at Phase 6 (`packSpans` does their side-by-side layout). Empty hours are
 * the normal state, not a gap (L5).
 */
export function TimelineView({ days, todayDate }: { days: ISODate[]; todayDate: ISODate }) {
  const { t } = useTranslation();
  const locale = useCalendar((s) => s.locale);
  const select = useCalendar((s) => s.select);
  const selected = useCalendar((s) => s.selected);
  const timeFormat = useSettings((s) => s.timeFormat);
  const { chipFor, onDropEntry } = useDayChips(days);

  const tag = bcp47(locale);
  const dayFormat = new Intl.DateTimeFormat(tag, {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const hourFormat = new Intl.DateTimeFormat(tag, {
    hour: 'numeric',
    timeZone: 'UTC',
    ...(timeFormat === '12h' ? { hourCycle: 'h12' as const } : {}),
    ...(timeFormat === '24h' ? { hourCycle: 'h23' as const } : {}),
  });
  const hourLabel = (hour: number) => hourFormat.format(hour * 3_600_000);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[40rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] text-sm">
        {/* header row */}
        <div />
        {days.map((date) => (
          <button
            key={date}
            type="button"
            onClick={() => select(date)}
            className={[
              'border-b border-line px-1 py-1.5 text-center text-xs font-medium capitalize',
              date === todayDate ? 'text-accent' : 'text-ink-muted',
              date === selected ? 'bg-accent-soft/60' : '',
            ].join(' ')}
          >
            {dayFormat.format(dateFromISO(date))}
          </button>
        ))}

        {/* all-day lane: the day-record contributions, droppable like the grids */}
        <div className="border-b border-line py-1 pr-1 text-right text-[11px] text-ink-muted">
          {t('allDay')}
        </div>
        {days.map((date) => {
          const chip = chipFor(date);
          return (
            <div
              key={date}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = e.dataTransfer.getData('text/almanac-day');
                if (from !== '') onDropEntry(from, date);
              }}
              className="min-h-8 border-b border-l border-line p-1"
            >
              {chip !== undefined && (
                <span
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/almanac-day', date)}
                  className="block max-w-full cursor-grab truncate rounded bg-accent-soft px-1 py-0.5 text-[11px] leading-tight"
                >
                  {chip}
                </span>
              )}
            </div>
          );
        })}

        {/* hour rows — the surface timed events (Phase 6) render into */}
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} className="contents">
            <div className="h-10 pr-1 text-right text-[11px] leading-10 text-ink-muted">
              {hourLabel(hour)}
            </div>
            {days.map((date) => (
              <div
                key={`${date}-${hour}`}
                className={[
                  'h-10 border-b border-l border-line/60',
                  date === todayDate ? 'bg-accent-soft/20' : '',
                ].join(' ')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
