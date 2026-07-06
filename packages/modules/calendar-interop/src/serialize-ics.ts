import { addDays } from '@almanac/core';
import type { CalendarEvent } from './types.js';
import { escapeText } from './unfold.js';
import { formatIcsDateValue, formatIcsUtc } from './ics-date.js';
import { formatRrule } from './rrule.js';

const PRODID = '-//Almanac//Calendar//EN';

/** Fold a content line at 75 octets, continuations led by a space (RFC 5545 §3.1). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    chunks.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length > 0) chunks.push(' ' + rest);
  return chunks.join('\r\n');
}

/** DTSTAMP for an event when none is injected — derived from its start (L4: no clock here). */
function stampFor(event: CalendarEvent): number {
  if ('span' in event.when) return event.when.span.startUtc;
  return Date.parse(`${event.when.allDay}T00:00:00Z`);
}

function serializeEvent(event: CalendarEvent, dtstampUtc: number | undefined): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${event.uid}`];
  lines.push(`DTSTAMP:${formatIcsUtc(dtstampUtc ?? stampFor(event))}`);

  if ('allDay' in event.when) {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDateValue(event.when.allDay)}`);
    // ICS all-day DTEND is exclusive — the day after.
    lines.push(`DTEND;VALUE=DATE:${formatIcsDateValue(addDays(event.when.allDay, 1))}`);
  } else {
    lines.push(`DTSTART:${formatIcsUtc(event.when.span.startUtc)}`);
    lines.push(`DTEND:${formatIcsUtc(event.when.span.endUtc)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description !== undefined) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location !== undefined) lines.push(`LOCATION:${escapeText(event.location)}`);

  if (event.recurrence !== undefined) {
    lines.push(`RRULE:${formatRrule(event.recurrence)}`);
    const exDates = event.recurrence.exDates ?? [];
    if (exDates.length > 0) {
      lines.push(`EXDATE;VALUE=DATE:${exDates.map(formatIcsDateValue).join(',')}`);
    }
  }
  lines.push('END:VEVENT');
  return lines;
}

/**
 * Serialize events to an RFC 5545 VCALENDAR document. Pure (L3/L4): `dtstampUtc`
 * is injected by the caller (the app passes its clock); absent, DTSTAMP is
 * derived deterministically from each event's start. All-day events use
 * `VALUE=DATE` with an exclusive end; timed events serialize in UTC.
 */
export function serializeIcs(events: readonly CalendarEvent[], dtstampUtc?: number): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
  ];
  for (const event of events) lines.push(...serializeEvent(event, dtstampUtc));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
