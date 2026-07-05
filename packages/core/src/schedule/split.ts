import type { ISODate } from '../time/iso-date.js';
import { isValidISODate } from '../time/iso-date.js';
import { addDays, diffDays } from '../time/date-math.js';
import type { Recurrence } from './recurrence.js';
import { occurrencesInRange } from './recurrence.js';

/**
 * "This and following" (roadmap P6) — the third standard edit scope beside
 * "this one" (an override) and "all" (edit the rule): cap the old rule with
 * `until` and spawn a successor starting at the split date. The caller stores
 * the successor as a new series and edits it freely.
 */
export interface SeriesSplit {
  /** The capped original — `null` when nothing occurs before the split. */
  before: Recurrence | null;
  after: Recurrence;
}

/**
 * Split at `at` (the first date belonging to the successor). A `count` is
 * partitioned by consumption; `exDates` go where they fall. Malformed input
 * degrades to "no split": the original series stays intact as `after` —
 * a failed split never damages the series (L5).
 */
export function splitSeries(rule: Recurrence, at: ISODate): SeriesSplit {
  if (!isValidISODate(at) || !isValidISODate(rule.start) || diffDays(rule.start, at) <= 0) {
    return { before: null, after: rule };
  }

  const lastBefore = addDays(at, -1);
  const consumed = occurrencesInRange(rule, rule.start, lastBefore).length;
  if (consumed === 0) return { before: null, after: rule };

  const exBefore = (rule.exDates ?? []).filter(
    (d) => isValidISODate(d) && diffDays(d, lastBefore) >= 0,
  );
  const exAfter = (rule.exDates ?? []).filter(
    (d) => isValidISODate(d) && diffDays(d, lastBefore) < 0,
  );

  const before: Recurrence = {
    ...rule,
    // The cap: whichever ends the old series first wins.
    until: rule.until !== undefined && diffDays(rule.until, lastBefore) > 0 ? rule.until : lastBefore,
    ...(rule.count !== undefined ? { count: consumed } : {}),
    ...(rule.exDates !== undefined ? { exDates: exBefore } : {}),
  };

  const after: Recurrence = {
    ...rule,
    // Day-of-month / weekday patterns derive from `start`, so the successor
    // must start on an occurrence; `at` is the split point the caller chose.
    start: at,
    ...(rule.count !== undefined ? { count: Math.max(0, rule.count - consumed) } : {}),
    ...(rule.exDates !== undefined ? { exDates: exAfter } : {}),
  };

  return { before, after };
}
