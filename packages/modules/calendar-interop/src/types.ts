import type { ISODate, Recurrence, TimedSpan } from '@almanac/core';

/**
 * When an event happens — structurally identical to the tasks module's
 * `EventWhen` (all-day stays a pure date; timed uses the 5.2 `TimedSpan`
 * contract). Redeclared here so this module imports no other module (L1); the
 * app maps between the two by plain assignment (they share a shape).
 */
export type IcsWhen = { allDay: ISODate } | { span: TimedSpan };

/**
 * A neutral calendar event — the boundary DTO this module reads ICS into and
 * writes ICS out of. It carries only what RFC 5545 round-trips; the app maps it
 * onto the tasks event shape (D7) on import and back on export. Deliberately not
 * the tasks `EventItem`: this module knows nothing about modules (L1).
 */
export interface CalendarEvent {
  /** RFC 5545 UID — stable identity across import/export round-trips. */
  uid: string;
  title: string;
  description?: string;
  location?: string;
  when: IcsWhen;
  recurrence?: Recurrence;
}

/**
 * The result of importing a file. `skipped` counts VEVENTs that couldn't be
 * turned into an event (missing/unparseable DTSTART, malformed block) — they are
 * dropped and tallied, never aborting the file (L5, §9). "imported 34, skipped 2".
 */
export interface ImportResult {
  events: CalendarEvent[];
  skipped: number;
}
