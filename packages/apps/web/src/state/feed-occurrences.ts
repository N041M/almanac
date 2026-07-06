import { daysCovered, diffDays, occurrencesInRange, type ISODate } from '@almanac/core';
import type { CalendarEvent } from '@almanac/calendar-interop';

/**
 * Expand subscription events across a date range into per-day titles — the
 * read-only counterpart to the tasks occurrence expansion. Recurring events use
 * the core primitive; timed spans contribute to every day they touch; malformed
 * data simply yields nothing (L5). Titles only — feeds are read-only overlays.
 */
export function feedOccurrences(
  events: ReadonlyArray<CalendarEvent>,
  start: ISODate,
  end: ISODate,
  viewerZone: string,
): Map<ISODate, string[]> {
  const map = new Map<ISODate, string[]>();
  const add = (date: ISODate, title: string): void => {
    if (diffDays(start, date) < 0 || diffDays(date, end) < 0) return;
    const list = map.get(date) ?? [];
    list.push(title);
    map.set(date, list);
  };

  for (const event of events) {
    if (event.recurrence !== undefined) {
      for (const date of occurrencesInRange(event.recurrence, start, end)) add(date, event.title);
    } else if ('allDay' in event.when) {
      add(event.when.allDay, event.title);
    } else {
      for (const date of daysCovered(event.when.span, viewerZone)) add(date, event.title);
    }
  }
  return map;
}
