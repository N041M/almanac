import type { KeyboardEventHandler } from 'react';
import type { CalendarCell } from '@almanac/core';
import { useCalendar } from '../state/store';
import { DayCell } from './DayCell';
import { useDayChips } from './use-day-chips';

interface MonthGridProps {
  grid: CalendarCell[][];
  weekdayLabels: string[];
  cellLabel: (date: string) => string;
  gridLabel: string;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export function MonthGrid({ grid, weekdayLabels, cellLabel, gridLabel, onKeyDown }: MonthGridProps) {
  const selected = useCalendar((s) => s.selected);
  const starred = useCalendar((s) => s.starred);
  const select = useCalendar((s) => s.select);
  const { chipsFor, tasksFor, onDropEntry } = useDayChips(grid.flat().map((c) => c.date));

  return (
    <div
      role="grid"
      aria-label={gridLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-activedescendant={selected === null ? undefined : `day-${selected}`}
      className="grid grid-cols-7 gap-1 rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* `contents` keeps rows in the ARIA tree without breaking the 7-col grid. */}
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

      {grid.map((week, wi) => (
        <div key={week[0]?.date ?? String(wi)} role="row" className="contents">
          {week.map((cell) => (
            <DayCell
              key={cell.date}
              date={cell.date}
              ariaLabel={cellLabel(cell.date)}
              muted={!cell.inMonth}
              isToday={cell.isToday}
              isSelected={cell.date === selected}
              isStarred={starred[cell.date] ?? false}
              chips={chipsFor(cell.date)}
              tasks={tasksFor(cell.date)}
              onSelect={select}
              onDropEntry={onDropEntry}
              shapeClass="aspect-square"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
