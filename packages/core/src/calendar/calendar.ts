import type { ISODate } from '../time/iso-date.js';
import type { Weekday } from '../time/date-math.js';
import { addDays, startOfWeek, daysInMonth, diffDays } from '../time/date-math.js';

/** A cell in a rendered grid — the calendar is a pure lens; the client draws it. */
export interface CalendarCell {
  date: ISODate;
  /** False for the leading/trailing days that belong to an adjacent month. */
  inMonth: boolean;
  /** Marked when it equals the injected "today" (optional). */
  isToday: boolean;
}

/** The seven dates of the week containing `anchor`, honouring the locale week-start. */
export function buildWeek(anchor: ISODate, weekStartsOn: Weekday): ISODate[] {
  const start = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * A month grid as weeks of seven cells, aligned to the locale week-start. The
 * number of weeks flexes (4–6) to exactly cover the month plus its lead/trail.
 */
export function buildMonthGrid(
  year: number,
  month: number, // 1–12
  weekStartsOn: Weekday,
  today?: ISODate,
): CalendarCell[][] {
  const yearStr = year.toString().padStart(4, '0');
  const monthStr = month.toString().padStart(2, '0');
  const firstOfMonth: ISODate = `${yearStr}-${monthStr}-01`;
  const gridStart = startOfWeek(firstOfMonth, weekStartsOn);
  const lead = diffDays(gridStart, firstOfMonth);
  const weeks = Math.ceil((lead + daysInMonth(year, month)) / 7);

  const grid: CalendarCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(gridStart, w * 7 + d);
      row.push({
        date,
        inMonth: date.slice(0, 7) === `${yearStr}-${monthStr}`,
        isToday: today !== undefined && date === today,
      });
    }
    grid.push(row);
  }
  return grid;
}
