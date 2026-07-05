import type { ISODate } from '../time/iso-date.js';
import { isValidISODate } from '../time/iso-date.js';

/**
 * The series-vs-instance contract (roadmap 5.1): the series stays **one
 * rule**; each edited or cancelled occurrence is one small record stored in
 * the owning module's slice, keyed by the date it modifies. `changes` is the
 * module's own partial-event shape — the core never interprets it.
 */
export interface InstanceOverride<C = unknown> {
  seriesId: string;
  occurrenceDate: ISODate;
  changes: C | 'cancelled';
}

/** One rendered instance: an occurrence date plus any override changes. */
export interface Occurrence<C = unknown> {
  date: ISODate;
  /** Present only when an override modifies this instance. */
  changes?: C;
}

/**
 * Post-process `occurrencesInRange` output with a series' overrides (the
 * caller selects them by `seriesId`). The L5 acceptance rows are the contract:
 * a cancelled instance disappears; a changed one carries its changes; an
 * override referencing a non-occurrence is inert; a corrupt record is skipped
 * — **an override can never take down its series.**
 */
export function applyOverrides<C = unknown>(
  dates: ReadonlyArray<ISODate>,
  overrides: ReadonlyArray<InstanceOverride<C>>,
): Occurrence<C>[] {
  const byDate = new Map<ISODate, InstanceOverride<C>>();
  for (const override of overrides) {
    if (
      typeof override === 'object' &&
      override !== null &&
      typeof override.occurrenceDate === 'string' &&
      isValidISODate(override.occurrenceDate) &&
      override.changes !== undefined
    ) {
      byDate.set(override.occurrenceDate, override);
    }
    // else: corrupt record → skipped; the base series renders intact (L5)
  }

  const out: Occurrence<C>[] = [];
  for (const date of dates) {
    const override = byDate.get(date);
    if (override === undefined) {
      out.push({ date });
    } else if (override.changes !== 'cancelled') {
      out.push({ date, changes: override.changes as C });
    }
    // 'cancelled' → the instance simply isn't emitted
  }
  return out;
}
