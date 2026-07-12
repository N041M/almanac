import type { ISODate } from '@almanac/core';

/**
 * A birthday (§8): a person and a calendar day, recurring yearly. The birth
 * year is optional — plenty of people share the day but not the year, and an
 * absent year just means no age is shown (L5). Platform-contacts import comes
 * later behind a capability port; manual entries are the module's full core
 * behaviour.
 */
export interface Birthday {
  id: string;
  name: string;
  /** 1–12. */
  month: number;
  /** 1–31 (validated against the month on entry). */
  day: number;
  /** null = unknown — the ordinary state, no age shown (L5). */
  year: number | null;
}

/** Does this birthday fall on `date`? Feb 29 celebrates on Feb 28 off-leap-years. */
export function fallsOn(birthday: Birthday, date: ISODate): boolean {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (birthday.month === month && birthday.day === day) return true;
  // The Feb-29 clamp: in a year with no Feb 29, the 28th carries it.
  if (birthday.month === 2 && birthday.day === 29 && month === 2 && day === 28) {
    const year = Number(date.slice(0, 4));
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return !leap;
  }
  return false;
}

/** The age turned on that day's occurrence, or null when the year is unknown. */
export function ageOn(birthday: Birthday, date: ISODate): number | null {
  if (birthday.year === null) return null;
  const age = Number(date.slice(0, 4)) - birthday.year;
  return age >= 0 ? age : null;
}

/** Every birthday falling on `date`, in name order (empty = the normal day). */
export function birthdaysOn(
  entries: ReadonlyArray<Birthday>,
  date: ISODate,
): Birthday[] {
  return entries
    .filter((entry) => fallsOn(entry, date))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A calendar-day validity check for the add form (no Feb 31, Apr 31, …). */
export function isValidCalendarDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const longest = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return longest !== undefined && day <= longest;
}
