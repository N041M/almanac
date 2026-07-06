import { isValidISODate, type ISODate, type Recurrence, type Weekday, type WeekdayPos } from '@almanac/core';

const ICS_TO_WEEKDAY: Record<string, Weekday> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};
const WEEKDAY_TO_ICS: string[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const FREQ_MAP = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

const NTH_VALUES: ReadonlyArray<WeekdayPos['nth']> = [1, 2, 3, 4, 5, -1];

/**
 * RRULE → the core `Recurrence` primitive (§5), given the series start date the
 * rule anchors to. Maps the subset the app uses: FREQ, INTERVAL, COUNT, UNTIL,
 * and BYDAY (weekday list when weekly, an "nth weekday" position when monthly).
 * Unsupported parts are ignored, not fatal (L5): a rule that doesn't map at all
 * (no/unknown FREQ) yields `undefined` and the event imports as a single entry.
 */
export function parseRrule(value: string, start: ISODate): Recurrence | undefined {
  const parts = new Map<string, string>();
  for (const seg of value.split(';')) {
    const eq = seg.indexOf('=');
    if (eq === -1) continue;
    parts.set(seg.slice(0, eq).trim().toUpperCase(), seg.slice(eq + 1).trim());
  }

  const freqRaw = parts.get('FREQ')?.toUpperCase();
  const freq = freqRaw !== undefined ? FREQ_MAP[freqRaw as keyof typeof FREQ_MAP] : undefined;
  if (freq === undefined) return undefined;

  const rec: Recurrence = { freq, start };
  const interval = Number(parts.get('INTERVAL'));
  if (Number.isFinite(interval) && interval > 1) rec.interval = interval;
  const count = Number(parts.get('COUNT'));
  if (Number.isFinite(count) && count > 0) rec.count = Math.floor(count);

  const until = parts.get('UNTIL');
  if (until !== undefined) {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(until);
    if (m !== null) {
      const date = `${m[1]}-${m[2]}-${m[3]}`;
      if (isValidISODate(date)) rec.until = date as ISODate;
    }
  }

  const byday = parts.get('BYDAY');
  if (byday !== undefined && byday.trim() !== '') {
    const entries = byday.split(',').map((s) => s.trim()).filter((s) => s !== '');
    if (freq === 'monthly') {
      const first = entries[0];
      const pm = first !== undefined ? /^(-?\d+)(SU|MO|TU|WE|TH|FR|SA)$/.exec(first) : null;
      if (pm !== null) {
        const nth = Number(pm[1]);
        const weekday = ICS_TO_WEEKDAY[pm[2] ?? ''];
        if (weekday !== undefined && NTH_VALUES.includes(nth as WeekdayPos['nth'])) {
          rec.byWeekdayPos = { weekday, nth: nth as WeekdayPos['nth'] };
        }
      }
    } else if (freq === 'weekly') {
      const days = entries
        .map((e) => ICS_TO_WEEKDAY[e.replace(/^[-+]?\d+/, '')])
        .filter((w): w is Weekday => w !== undefined);
      if (days.length > 0) rec.byWeekday = days;
    }
  }
  return rec;
}

/** The core `Recurrence` → an RRULE value string (no `RRULE:` prefix). */
export function formatRrule(rec: Recurrence): string {
  const parts: string[] = [`FREQ=${rec.freq.toUpperCase()}`];
  if (rec.interval !== undefined && rec.interval > 1) parts.push(`INTERVAL=${rec.interval}`);

  if (rec.byWeekdayPos !== undefined) {
    const code = WEEKDAY_TO_ICS[rec.byWeekdayPos.weekday];
    if (code !== undefined) parts.push(`BYDAY=${rec.byWeekdayPos.nth}${code}`);
  } else if (rec.byWeekday !== undefined && rec.byWeekday.length > 0) {
    const codes = rec.byWeekday.map((w) => WEEKDAY_TO_ICS[w]).filter((c): c is string => c !== undefined);
    if (codes.length > 0) parts.push(`BYDAY=${codes.join(',')}`);
  }

  if (rec.count !== undefined) parts.push(`COUNT=${rec.count}`);
  if (rec.until !== undefined) parts.push(`UNTIL=${rec.until.replace(/-/g, '')}`);
  return parts.join(';');
}
