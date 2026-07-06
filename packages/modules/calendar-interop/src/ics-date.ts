import { isValidISODate, type ISODate } from '@almanac/core';

/** A parsed DTSTART/DTEND: either an all-day date or an absolute instant. */
export type IcsDate =
  | { kind: 'date'; date: ISODate }
  | { kind: 'datetime'; utcMs: number; zone: string };

const DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;
const DATETIME_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/;

/** The zone's UTC offset (ms) at an instant, via Intl; unknown zone → null. */
function offsetMsAt(zone: string, utcMs: number): number | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(utcMs);
    const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    return Number.isFinite(asUtc) ? asUtc - utcMs : null;
  } catch {
    return null;
  }
}

/** Wall-clock fields in a zone → absolute UTC ms (one offset-correction pass). */
function wallClockToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  zone: string,
): number | null {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  if (!Number.isFinite(guess)) return null;
  const offset = offsetMsAt(zone, guess);
  if (offset === null) return null;
  return guess - offset;
}

/**
 * Parse an ICS DTSTART/DTEND value + its params. Handles VALUE=DATE (all-day),
 * DATE-TIME with a trailing `Z` (UTC), and DATE-TIME with a TZID param
 * (wall-clock in that zone). A floating DATE-TIME (no `Z`, no TZID) is read as
 * UTC — a defined degradation (L5). Malformed input → null (the VEVENT is then
 * skipped and counted, never a throw).
 */
export function parseIcsDate(value: string, params: Record<string, string>): IcsDate | null {
  const isDate = params['VALUE'] === 'DATE' || (!value.includes('T') && DATE_RE.test(value));
  if (isDate) {
    const m = DATE_RE.exec(value);
    if (m === null) return null;
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    return isValidISODate(date) ? { kind: 'date', date: date as ISODate } : null;
  }

  const m = DATETIME_RE.exec(value);
  if (m === null) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const nums = [y, mo, d, h, mi, s].map(Number) as [number, number, number, number, number, number];

  if (z === 'Z') {
    const utcMs = Date.UTC(nums[0], nums[1] - 1, nums[2], nums[3], nums[4], nums[5]);
    return Number.isFinite(utcMs) ? { kind: 'datetime', utcMs, zone: 'UTC' } : null;
  }

  const tzid = params['TZID'];
  if (tzid !== undefined) {
    const utcMs = wallClockToUtc(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], tzid);
    // Unknown zone → treat the wall clock as UTC rather than dropping it (L5).
    if (utcMs !== null) return { kind: 'datetime', utcMs, zone: tzid };
  }
  const asUtc = Date.UTC(nums[0], nums[1] - 1, nums[2], nums[3], nums[4], nums[5]);
  return Number.isFinite(asUtc) ? { kind: 'datetime', utcMs: asUtc, zone: 'UTC' } : null;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** An ISODate → the ICS DATE value `YYYYMMDD`. */
export function formatIcsDateValue(date: ISODate): string {
  return date.replace(/-/g, '');
}

/** An absolute instant → the ICS UTC DATE-TIME value `YYYYMMDDTHHMMSSZ`. */
export function formatIcsUtc(utcMs: number): string {
  const d = new Date(utcMs);
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}
