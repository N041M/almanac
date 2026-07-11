import type { KeyboardEventHandler } from 'react';
import type { ISODate } from '@almanac/core';
import { useCalendar } from '../state/store';
import { DayCell } from './DayCell';
import { useDayChips } from './use-day-chips';

interface WeekGridProps {
  /** The seven dates of the visible week, in display order. */
  days: ISODate[];
  todayDate: ISODate;
  weekdayLabels: string[];
  cellLabel: (date: string) => string;
  gridLabel: string;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export function WeekGrid({
  days,
  todayDate,
  weekdayLabels,
  cellLabel,
  gridLabel,
  onKeyDown,
}: WeekGridProps) {
  const selected = useCalendar((s) => s.selected);
  const starred = useCalendar((s) => s.starred);
  const select = useCalendar((s) => s.select);
  const { chipsFor, tasksFor, onDropEntry } = useDayChips(days);

  return (
    <div
      role="grid"
      aria-label={gridLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-activedescendant={selected === null ? undefined : `day-${selected}`}
      className="grid grid-cols-7 gap-1 rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div role="row" className="contents">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="py-1.5 text-center text-xs font-medium uppercase tracking-wide text-ink-muted"
          >
            {label}
          </div>
        ))}
      </div>

      <div role="row" className="contents">
        {days.map((date) => (
          <DayCell
            key={date}
            date={date}
            ariaLabel={cellLabel(date)}
            muted={false}
            isToday={date === todayDate}
            isSelected={date === selected}
            isStarred={starred[date] ?? false}
            chips={chipsFor(date)}
            tasks={tasksFor(date)}
            onSelect={select}
            onDropEntry={onDropEntry}
            shapeClass="min-h-48"
          />
        ))}
      </div>
    </div>
  );
}
