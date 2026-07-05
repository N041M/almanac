import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISODate } from '@almanac/core';

interface DayCellProps {
  date: ISODate;
  ariaLabel: string;
  /** Rendered de-emphasized (e.g. out-of-month lead/trail days). */
  muted: boolean;
  isToday: boolean;
  isSelected: boolean;
  isStarred: boolean;
  onSelect: (date: ISODate) => void;
  /** Shape/size classes from the hosting grid (aspect, height, …). */
  shapeClass: string;
  /** Extra cell content above the date number (e.g. week view's weekday). */
  children?: ReactNode;
}

/** One calendar day cell — the same interaction surface in every grid. */
export function DayCell({
  date,
  ariaLabel,
  muted,
  isToday,
  isSelected,
  isStarred,
  onSelect,
  shapeClass,
  children,
}: DayCellProps) {
  const { t } = useTranslation();
  return (
    <button
      id={`day-${date}`}
      role="gridcell"
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-current={isToday ? 'date' : undefined}
      aria-selected={isSelected}
      onClick={() => onSelect(date)}
      className={[
        // buttons center their content by default; pin it to the top-left
        'relative flex flex-col items-start rounded-lg p-1.5 text-left transition-colors',
        shapeClass,
        muted ? 'text-ink-faint' : 'text-ink',
        isToday ? 'ring-1 ring-accent' : '',
        isSelected ? 'bg-accent-soft' : 'hover:bg-accent-soft/50',
      ].join(' ')}
    >
      {children}
      <span
        className={[
          'text-xs tabular-nums',
          isToday ? 'font-semibold text-accent' : '',
        ].join(' ')}
      >
        {Number(date.slice(8, 10))}
      </span>
      {isStarred && (
        <span
          aria-label={t('starredLegend')}
          className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-mark"
        />
      )}
    </button>
  );
}
