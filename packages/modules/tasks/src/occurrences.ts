import {
  applyOverrides,
  daysCovered,
  diffDays,
  occurrencesInRange,
  type ISODate,
} from '@almanac/core';
import type { EventItem, EventPatch, TaskItem } from './types.js';

/** One thing on one day — what the calendar and agenda render. */
export interface DayOccurrence {
  date: ISODate;
  item: TaskItem;
  /** Override changes for this instance of a recurring event (5.1). */
  changes?: EventPatch;
  /**
   * For multi-day spans: this occurrence is day `spanDay + 1` of `spanDays`.
   * Absent for single-day entries.
   */
  spanDay?: number;
  spanDays?: number;
}

function inRange(date: ISODate, start: ISODate, end: ISODate): boolean {
  return diffDays(start, date) >= 0 && diffDays(date, end) >= 0;
}

function eventOccurrences(
  item: EventItem,
  start: ISODate,
  end: ISODate,
  viewerZone: string,
): DayOccurrence[] {
  // Timed span: contributes to every day it touches in the display zone (5.2).
  if ('span' in item.when) {
    const days = daysCovered(item.when.span, viewerZone);
    return days
      .map((date, i): DayOccurrence => ({ date, item, spanDay: i, spanDays: days.length }))
      .filter((o) => inRange(o.date, start, end));
  }

  // All-day: one date, or a series expanded then override-adjusted (5.1).
  if (item.recurrence !== undefined) {
    const dates = occurrencesInRange(item.recurrence, start, end);
    return applyOverrides<EventPatch>(dates, item.overrides ?? []).map((occurrence) => ({
      date: occurrence.date,
      item,
      ...(occurrence.changes !== undefined && { changes: occurrence.changes }),
    }));
  }
  return inRange(item.when.allDay, start, end) ? [{ date: item.when.allDay, item }] : [];
}

/**
 * Everything in `[start, end]`, keyed by date — the module's answer to the
 * calendar's one question. Malformed rules and corrupt overrides degrade
 * inside the core primitives; an item that yields nothing simply contributes
 * nothing (L5).
 */
export function occurrencesForRange(
  items: ReadonlyArray<TaskItem>,
  start: ISODate,
  end: ISODate,
  viewerZone: string,
): Map<ISODate, DayOccurrence[]> {
  const byDate = new Map<ISODate, DayOccurrence[]>();
  const add = (occurrence: DayOccurrence) => {
    const list = byDate.get(occurrence.date) ?? [];
    list.push(occurrence);
    byDate.set(occurrence.date, list);
  };

  for (const item of items) {
    switch (item.kind) {
      case 'event':
        for (const occurrence of eventOccurrences(item, start, end, viewerZone)) add(occurrence);
        break;
      case 'task': {
        if (item.recurrence !== undefined) {
          for (const date of occurrencesInRange(item.recurrence, start, end)) add({ date, item });
        } else if (item.due !== undefined && inRange(item.due.date, start, end)) {
          add({ date: item.due.date, item });
        }
        // A task with no due date has no day — it lives in lists, not cells.
        break;
      }
      case 'habit':
        for (const date of occurrencesInRange(item.recurrence, start, end)) add({ date, item });
        break;
    }
  }
  return byDate;
}

/** Current streak length: consecutive scheduled days completed, ending at `today`. */
export function habitStreak(
  completions: ReadonlyArray<ISODate>,
  scheduled: ReadonlyArray<ISODate>,
  today: ISODate,
): number {
  const done = new Set(completions);
  let streak = 0;
  for (let i = scheduled.length - 1; i >= 0; i--) {
    const date = scheduled[i];
    if (date === undefined || diffDays(date, today) < 0) continue; // future dates don't count
    if (done.has(date)) streak += 1;
    else if (date !== today) break; // today still open doesn't break the streak
  }
  return streak;
}
