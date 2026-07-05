import type { ISODate } from './iso-date.js';
import { isValidISODate } from './iso-date.js';
import { addDays, diffDays } from './date-math.js';

/**
 * A timed event's when (roadmap 5.2). The instant is **absolute** (UTC ms) —
 * travel and DST can never corrupt it; `zone` is only the *display intent*
 * (IANA id, e.g. "Europe/Prague"). All-day events are not spans — they stay
 * pure `ISODate` (timezone-free by design).
 */
export interface TimedSpan {
  startUtc: number;
  endUtc: number;
  zone: string;
}

// Intl.DateTimeFormat construction is expensive; zones repeat constantly.
const formatters = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(zone: string): Intl.DateTimeFormat | null {
  const cached = formatters.get(zone);
  if (cached !== undefined) return cached;
  let formatter: Intl.DateTimeFormat | null;
  try {
    // en-CA formats as YYYY-MM-DD, which IS the ISODate shape.
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    formatter = null; // unknown/malformed IANA id
  }
  formatters.set(zone, formatter);
  return formatter;
}

export function isValidTimeZone(zone: string): boolean {
  return formatterFor(zone) !== null;
}

/**
 * The event zone when it's usable, else the viewer's, else UTC — the L5 row
 * "unknown/missing zone → render in the viewer's local zone", as a chain. The
 * viewer zone is *injected* by the app layer (the core never reads the
 * system's own zone, L4).
 */
export function resolveDisplayZone(eventZone: string | undefined, viewerZone: string): string {
  if (eventZone !== undefined && isValidTimeZone(eventZone)) return eventZone;
  if (isValidTimeZone(viewerZone)) return viewerZone;
  return 'UTC';
}

/**
 * The calendar date an instant falls on **in a zone** — the one bridge from
 * absolute time to the day-record world. A bad zone degrades to UTC (L5);
 * a non-finite instant is `null`, never a throw.
 */
export function dateInZone(utcMs: number, zone: string): ISODate | null {
  if (!Number.isFinite(utcMs)) return null;
  const formatter = formatterFor(zone) ?? formatterFor('UTC');
  const formatted = formatter?.format(utcMs) ?? '';
  return isValidISODate(formatted) ? formatted : null;
}

/**
 * Every calendar date a span touches in the display zone — "what touches this
 * date range?" is the calendar's one question about spans (multi-day banners
 * render from contiguous runs of these). Degradations (L5): end before start
 * ⇒ the start date alone (flagged in the editor, never dropped); non-finite
 * instants ⇒ `[]`.
 */
export function daysCovered(span: TimedSpan, displayZone: string): ISODate[] {
  const zone = resolveDisplayZone(span.zone, displayZone);
  const first = dateInZone(span.startUtc, zone);
  if (first === null) return [];
  // Half-open feel for midnight ends: an event ending exactly at 00:00 does
  // not occupy the day it ends on (unless it started there).
  const endsAtInstant = span.endUtc <= span.startUtc ? span.startUtc : span.endUtc - 1;
  const last = dateInZone(endsAtInstant, zone);
  if (last === null || diffDays(first, last) < 0) return [first];

  const out: ISODate[] = [];
  for (let d = first; diffDays(d, last) >= 0; d = addDays(d, 1)) {
    out.push(d);
    if (out.length > 366 * 5) break; // absurd spans stay bounded, quietly
  }
  return out;
}
