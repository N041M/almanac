import { useMemo } from 'react';
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
  const secondaryZone = useSettings((s) => s.secondaryZone);
  const workStartHour = useSettings((s) => s.workStartHour);
  const workEndHour = useSettings((s) => s.workEndHour);
  const { chipsFor, onDropEntry } = useDayChips(days);

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

  // 5.4: the optional second-zone column. An invalid IANA id renders no
  // column — the grid never breaks on a typo (L5).
  const secondaryFormat = useMemo(() => {
    if (secondaryZone === null) return null;
    try {
      return new Intl.DateTimeFormat(tag, {
        hour: 'numeric',
        timeZone: secondaryZone,
        ...(timeFormat === '12h' ? { hourCycle: 'h12' as const } : {}),
        ...(timeFormat === '24h' ? { hourCycle: 'h23' as const } : {}),
      });
    } catch {
      return null;
    }
  }, [secondaryZone, tag, timeFormat]);
  // The axis is wall-clock; anchor the mapping on the visible week's first day.
  const secondaryLabel = (hour: number): string => {
    const first = days[0];
    if (secondaryFormat === null || first === undefined) return '';
    const [y, m, d] = first.split('-').map(Number);
    return secondaryFormat.format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, hour));
  };
  const zoneName = secondaryZone?.split('/').pop()?.replace(/_/g, ' ') ?? '';

  // 5.4: shaded non-working hours — only when a sane range is set (L5).
  const working =
    workStartHour !== null && workEndHour !== null && workStartHour < workEndHour
      ? { start: workStartHour, end: workEndHour }
      : null;
  const offHours = (hour: number): boolean =>
    working !== null && (hour < working.start || hour >= working.end);

  const gridCols =
    secondaryFormat === null
      ? 'grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]'
      : 'grid-cols-[3.5rem_3.5rem_repeat(7,minmax(0,1fr))]';

  return (
    <div className="overflow-x-auto">
      <div className={`grid min-w-[40rem] ${gridCols} text-sm`}>
        {/* header row */}
        <div />
        {secondaryFormat !== null && (
          <div className="truncate border-b border-line px-1 py-1.5 text-center text-[11px] text-ink-faint">
            {zoneName}
          </div>
        )}
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
        {secondaryFormat !== null && <div className="border-b border-line" />}
        {days.map((date) => (
          <div
            key={date}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData('text/almanac-day');
              if (from !== '') onDropEntry(from, date);
            }}
            className="min-h-8 space-y-0.5 border-b border-l border-line p-1"
          >
            {chipsFor(date).map((chip, i) => (
              <span
                key={`${chip}-${i}`}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/almanac-day', date)}
                className="block max-w-full cursor-grab truncate rounded bg-accent-soft px-1 py-0.5 text-[11px] leading-tight"
              >
                {chip}
              </span>
            ))}
          </div>
        ))}

        {/* hour rows — the surface timed events (Phase 6) render into */}
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} className="contents">
            <div className="h-10 pr-1 text-right text-[11px] leading-10 text-ink-muted">
              {hourLabel(hour)}
            </div>
            {secondaryFormat !== null && (
              <div className="h-10 pr-1 text-right text-[11px] leading-10 text-ink-faint">
                {secondaryLabel(hour)}
              </div>
            )}
            {days.map((date) => (
              <div
                key={`${date}-${hour}`}
                className={[
                  'h-10 border-b border-l border-line/60',
                  date === todayDate ? 'bg-accent-soft/20' : '',
                  offHours(hour) ? 'bg-ink-faint/5' : '',
                ].join(' ')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
