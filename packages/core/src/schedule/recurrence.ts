import type { ISODate } from '../time/iso-date.js';
import type { Weekday } from '../time/date-math.js';
import { toEpochDay, fromEpochDay, isValidISODate } from '../time/iso-date.js';
import { diffDays, weekdayOf, startOfWeek, daysInMonth } from '../time/date-math.js';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Nth weekday of the month ("2nd Tuesday"); -1 = the last one (v2, 5.1). */
export interface WeekdayPos {
  weekday: Weekday;
  nth: 1 | 2 | 3 | 4 | 5 | -1;
}

/**
 * One RRULE-style recurrence — the single primitive behind to-dos, events,
 * habits, recurring shopping days, and meal-prep tasks (design §5). Nobody
 * re-implements recurrence. v2 (roadmap 5.1) extends v1 **additively**:
 * yearly, `byWeekdayPos`, `exDates` — every v1 rule keeps working unchanged.
 */
export interface Recurrence {
  freq: Frequency;
  /** First candidate date; occurrences never precede it. */
  start: ISODate;
  /** Every Nth day/week/month/year (default 1). */
  interval?: number;
  /** Weekly only: which weekdays fire (default: the start's weekday). */
  byWeekday?: Weekday[];
  /** Monthly only: "nth weekday" instead of the start's day-of-month. */
  byWeekdayPos?: WeekdayPos;
  /** Cap on total occurrences from `start` (across all time, not the range). */
  count?: number;
  /** Inclusive last date an occurrence may fall on. */
  until?: ISODate;
  /**
   * "Delete just this occurrence": these dates are generated (they consume
   * `count`) and then dropped. Malformed entries are ignored (L5).
   */
  exDates?: ISODate[];
}

function monthIndex(date: ISODate): number {
  return Number(date.slice(0, 4)) * 12 + (Number(date.slice(5, 7)) - 1);
}

function matches(rule: Recurrence, date: ISODate): boolean {
  const interval = Math.max(1, rule.interval ?? 1);
  if (diffDays(rule.start, date) < 0) return false;

  switch (rule.freq) {
    case 'daily':
      return diffDays(rule.start, date) % interval === 0;

    case 'weekly': {
      const weekBlock =
        (toEpochDay(startOfWeek(date, 1)) - toEpochDay(startOfWeek(rule.start, 1))) / 7;
      if (weekBlock % interval !== 0) return false;
      const days = rule.byWeekday ?? [weekdayOf(rule.start)];
      return days.includes(weekdayOf(date));
    }

    case 'monthly': {
      if ((monthIndex(date) - monthIndex(rule.start)) % interval !== 0) return false;
      const pos = rule.byWeekdayPos;
      if (pos !== undefined) {
        if (weekdayOf(date) !== pos.weekday) return false;
        const day = Number(date.slice(8, 10));
        if (pos.nth === -1) {
          return day + 7 > daysInMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
        }
        return Math.ceil(day / 7) === pos.nth;
      }
      // Same day-of-month; months lacking that day simply never match (skip).
      return date.slice(8, 10) === rule.start.slice(8, 10);
    }

    case 'yearly': {
      const years = Number(date.slice(0, 4)) - Number(rule.start.slice(0, 4));
      if (years % interval !== 0) return false;
      // Same month + day; a Feb-29 start simply skips non-leap years (L5).
      return date.slice(5) === rule.start.slice(5);
    }
  }
}

/**
 * Occurrences within `[rangeStart, rangeEnd]` (inclusive), in ascending order.
 * Bounded by `count`/`until`. Never throws (L5): an empty/backwards range or a
 * malformed date in the rule or range yields `[]`.
 */
export function occurrencesInRange(
  rule: Recurrence,
  rangeStart: ISODate,
  rangeEnd: ISODate,
): ISODate[] {
  const out: ISODate[] = [];
  if (
    !isValidISODate(rule.start) ||
    !isValidISODate(rangeStart) ||
    !isValidISODate(rangeEnd) ||
    (rule.until !== undefined && !isValidISODate(rule.until))
  ) {
    return out;
  }
  if (diffDays(rangeStart, rangeEnd) < 0) return out;

  const hardEnd =
    rule.until !== undefined && diffDays(rule.until, rangeEnd) > 0 ? rule.until : rangeEnd;

  // Malformed exDate entries are ignored — they never invalidate the rule (L5).
  const excluded = new Set((rule.exDates ?? []).filter(isValidISODate));

  let seen = 0;
  // With a `count` cap, every occurrence since `start` must be counted, so the
  // walk begins there. Without one, skip straight to the window — a rule that
  // started years ago must not cost years of dead iterations per query.
  let cursor =
    rule.count !== undefined
      ? toEpochDay(rule.start)
      : Math.max(toEpochDay(rule.start), toEpochDay(rangeStart));
  const stop = toEpochDay(hardEnd);
  while (cursor <= stop) {
    const date = fromEpochDay(cursor);
    if (matches(rule, date)) {
      seen += 1;
      if (rule.count !== undefined && seen > rule.count) break;
      if (diffDays(rangeStart, date) >= 0 && !excluded.has(date)) out.push(date);
    }
    cursor += 1;
  }
  return out;
}
