import { dateInZone, type ISODate } from '@almanac/core';
import type { CalendarEvent, IcsWhen, ImportResult } from './types.js';
import { parseContentLines, unescapeText, type ContentLine } from './unfold.js';
import { parseIcsDate, type IcsDate } from './ics-date.js';
import { parseRrule } from './rrule.js';

/** An IcsDate → the calendar date it falls on (for recurrence start / EXDATE). */
function dateOf(d: IcsDate): ISODate | null {
  return d.kind === 'date' ? d.date : dateInZone(d.utcMs, d.zone);
}

function toWhen(start: IcsDate, end: IcsDate | null): IcsWhen {
  if (start.kind === 'date') return { allDay: start.date };
  // Missing/mismatched DTEND ⇒ a zero-length instant on the start (never dropped).
  const endUtc = end !== null && end.kind === 'datetime' ? end.utcMs : start.utcMs;
  return { span: { startUtc: start.utcMs, endUtc, zone: start.zone } };
}

/** Assemble one VEVENT's content lines into a CalendarEvent, or null to skip it. */
function buildEvent(lines: ContentLine[]): CalendarEvent | null {
  let uid: string | undefined;
  let title = '';
  let description: string | undefined;
  let location: string | undefined;
  let dtstart: IcsDate | null = null;
  let dtend: IcsDate | null = null;
  let rrule: string | undefined;
  const exDates: ISODate[] = [];

  for (const line of lines) {
    switch (line.name) {
      case 'UID':
        uid = line.value.trim();
        break;
      case 'SUMMARY':
        title = unescapeText(line.value);
        break;
      case 'DESCRIPTION':
        description = unescapeText(line.value);
        break;
      case 'LOCATION':
        location = unescapeText(line.value);
        break;
      case 'DTSTART':
        dtstart = parseIcsDate(line.value.trim(), line.params);
        break;
      case 'DTEND':
        dtend = parseIcsDate(line.value.trim(), line.params);
        break;
      case 'RRULE':
        rrule = line.value.trim();
        break;
      case 'EXDATE':
        for (const raw of line.value.split(',')) {
          const parsed = parseIcsDate(raw.trim(), line.params);
          const date = parsed !== null ? dateOf(parsed) : null;
          if (date !== null) exDates.push(date);
        }
        break;
      default:
        break;
    }
  }

  // No usable start → the event can't be placed on any day; skip and count (L5).
  if (dtstart === null) return null;
  const startDate = dateOf(dtstart);

  const event: CalendarEvent = {
    // A missing UID would break round-trip identity; synthesize a stable one.
    uid: uid !== undefined && uid !== '' ? uid : `${startDate ?? 'nodate'}@almanac.local`,
    title,
    when: toWhen(dtstart, dtend),
  };
  if (description !== undefined) event.description = description;
  if (location !== undefined) event.location = location;

  if (rrule !== undefined && startDate !== null) {
    const rec = parseRrule(rrule, startDate);
    if (rec !== undefined) {
      if (exDates.length > 0) rec.exDates = exDates;
      event.recurrence = rec;
    }
  }
  return event;
}

/**
 * Parse an ICS document into events. Never throws (L5, §9): each VEVENT is
 * independent — a malformed one is skipped and counted, the rest import. Nested
 * components (VALARM, VTIMEZONE) are ignored, not treated as events.
 */
export function parseIcs(text: string): ImportResult {
  const lines = parseContentLines(text);
  const events: CalendarEvent[] = [];
  let skipped = 0;
  let current: ContentLine[] | null = null;
  let depth = 0; // nesting inside the current VEVENT (e.g. a VALARM)

  for (const line of lines) {
    if (line.name === 'BEGIN') {
      if (current === null) {
        if (line.value.toUpperCase() === 'VEVENT') current = [];
      } else {
        depth += 1; // a sub-component of this VEVENT
      }
      continue;
    }
    if (line.name === 'END') {
      if (current !== null && depth > 0) {
        depth -= 1;
      } else if (current !== null && line.value.toUpperCase() === 'VEVENT') {
        const event = buildEvent(current);
        if (event !== null) events.push(event);
        else skipped += 1;
        current = null;
      }
      continue;
    }
    if (current !== null && depth === 0) current.push(line);
  }
  return { events, skipped };
}
