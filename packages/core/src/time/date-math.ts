import type { ISODate } from './iso-date.js';
import { toEpochDay, fromEpochDay, MS_PER_DAY } from './iso-date.js';

/** 0 = Sunday … 6 = Saturday (matches `Date.getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function addDays(date: ISODate, n: number): ISODate {
  return fromEpochDay(toEpochDay(date) + n);
}

/** Signed day count from `a` to `b` (`b - a`). */
export function diffDays(a: ISODate, b: ISODate): number {
  return toEpochDay(b) - toEpochDay(a);
}

export function weekdayOf(date: ISODate): Weekday {
  // Epoch day 0 (1970-01-01) was a Thursday (index 4 with Sunday = 0).
  const epochDay = toEpochDay(date);
  return ((((epochDay % 7) + 4) % 7 + 7) % 7) as Weekday;
}

export function startOfWeek(date: ISODate, weekStartsOn: Weekday): ISODate {
  const back = (weekdayOf(date) - weekStartsOn + 7) % 7;
  return addDays(date, -back);
}

export function endOfWeek(date: ISODate, weekStartsOn: Weekday): ISODate {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

/** Days in a given calendar month (month is 1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Add `n` months, clamping the day to the target month's length. */
export function addMonths(date: ISODate, n: number): ISODate {
  const epoch = toEpochDay(date);
  const d = new Date(epoch * MS_PER_DAY);
  const year = d.getUTCFullYear();
  const month0 = d.getUTCMonth() + n;
  const targetYear = year + Math.floor(month0 / 12);
  const targetMonth = ((month0 % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), daysInMonth(targetYear, targetMonth + 1));
  return fromEpochDay(
    Math.floor(Date.UTC(targetYear, targetMonth, day) / MS_PER_DAY),
  );
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 7)}-${daysInMonth(year, month).toString().padStart(2, '0')}`;
}
