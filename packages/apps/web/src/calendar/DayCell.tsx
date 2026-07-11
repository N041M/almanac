import type { DragEvent, ReactNode } from 'react';
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
  /** The day's meal contributions in slot order, already resolved to display names. */
  chips?: string[];
  /** Open task/event titles on this day (rendered compactly, max two + count). */
  tasks?: string[];
  onSelect: (date: ISODate) => void;
  /** Present ⇒ cells accept drops and chips are draggable (5.4 DnD). */
  onDropEntry?: (from: ISODate, to: ISODate) => void;
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
  chips = [],
  tasks = [],
  onSelect,
  onDropEntry,
  shapeClass,
  children,
}: DayCellProps) {
  const { t } = useTranslation();

  function onDrop(e: DragEvent): void {
    if (onDropEntry === undefined) return;
    e.preventDefault();
    const from = e.dataTransfer.getData('text/almanac-day');
    if (from !== '') onDropEntry(from, date);
  }

  return (
    <button
      id={`day-${date}`}
      role="gridcell"
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-current={isToday ? 'date' : undefined}
      aria-selected={isSelected}
      onClick={() => onSelect(date)}
      onDragOver={onDropEntry === undefined ? undefined : (e) => e.preventDefault()}
      onDrop={onDropEntry === undefined ? undefined : onDrop}
      className={[
        // buttons center their content by default; pin it to the top-left
        'relative flex flex-col items-start gap-0.5 rounded-lg p-1.5 text-left transition-colors',
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
      {chips.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          draggable={onDropEntry !== undefined}
          onDragStart={(e) => e.dataTransfer.setData('text/almanac-day', date)}
          className="max-w-full cursor-grab truncate rounded bg-accent-soft px-1 py-0.5 text-[11px] leading-tight"
        >
          {chip}
        </span>
      ))}
      {tasks.slice(0, 2).map((title, i) => (
        <span
          key={`${title}-${i}`}
          className="max-w-full truncate text-[11px] leading-tight text-ink-muted"
        >
          • {title}
        </span>
      ))}
      {tasks.length > 2 && (
        <span className="text-[11px] leading-tight text-ink-faint">+{tasks.length - 2}</span>
      )}
      {isStarred && (
        <span
          aria-label={t('starredLegend')}
          className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-mark"
        />
      )}
    </button>
  );
}
