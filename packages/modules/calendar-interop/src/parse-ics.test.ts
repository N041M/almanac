import { describe, expect, it } from 'vitest';
import { parseIcs } from './parse-ics.js';

/** ICS uses CRLF; build fixtures from lines so the folding/unfolding is exercised. */
function ics(...lines: string[]): string {
  return lines.join('\r\n');
}

describe('parseIcs (RFC 5545 subset, P8)', () => {
  it('parses an all-day event', () => {
    const { events, skipped } = parseIcs(
      ics(
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:a@x',
        'SUMMARY:Birthday',
        'DTSTART;VALUE=DATE:20260706',
        'DTEND;VALUE=DATE:20260707',
        'END:VEVENT',
        'END:VCALENDAR',
      ),
    );
    expect(skipped).toBe(0);
    expect(events).toEqual([{ uid: 'a@x', title: 'Birthday', when: { allDay: '2026-07-06' } }]);
  });

  it('parses a UTC timed event with description + location', () => {
    const { events } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:b@x',
        'SUMMARY:Standup',
        'DESCRIPTION:Daily sync\\, room 2',
        'LOCATION:HQ',
        'DTSTART:20260706T090000Z',
        'DTEND:20260706T093000Z',
        'END:VEVENT',
      ),
    );
    const event = events[0];
    expect(event?.title).toBe('Standup');
    expect(event?.description).toBe('Daily sync, room 2');
    expect(event?.location).toBe('HQ');
    expect(event?.when).toEqual({
      span: { startUtc: Date.UTC(2026, 6, 6, 9, 0, 0), endUtc: Date.UTC(2026, 6, 6, 9, 30, 0), zone: 'UTC' },
    });
  });

  it('resolves a TZID datetime to the correct absolute instant', () => {
    // Prague is UTC+2 in July (DST): 09:00 local = 07:00 UTC.
    const { events } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:c@x',
        'SUMMARY:Prague',
        'DTSTART;TZID=Europe/Prague:20260706T090000',
        'END:VEVENT',
      ),
    );
    const when = events[0]?.when;
    expect(when).toEqual({
      span: { startUtc: Date.UTC(2026, 6, 6, 7, 0, 0), endUtc: Date.UTC(2026, 6, 6, 7, 0, 0), zone: 'Europe/Prague' },
    });
  });

  it('maps a weekly RRULE with BYDAY + EXDATE to a core Recurrence', () => {
    const { events } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:d@x',
        'SUMMARY:Gym',
        'DTSTART;VALUE=DATE:20260706',
        'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10',
        'EXDATE;VALUE=DATE:20260720',
        'END:VEVENT',
      ),
    );
    expect(events[0]?.recurrence).toEqual({
      freq: 'weekly',
      start: '2026-07-06',
      interval: 2,
      count: 10,
      byWeekday: [1, 3],
      exDates: ['2026-07-20'],
    });
  });

  it('unfolds long folded lines before parsing', () => {
    const { events } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:e@x',
        'SUMMARY:A very long title that spilled over the seventy-five octet fold bound',
        ' ary',
        'DTSTART;VALUE=DATE:20260706',
        'END:VEVENT',
      ),
    );
    expect(events[0]?.title).toBe('A very long title that spilled over the seventy-five octet fold boundary');
  });

  it('ignores a VALARM sub-component without treating it as an event', () => {
    const { events, skipped } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:f@x',
        'SUMMARY:With alarm',
        'DTSTART;VALUE=DATE:20260706',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'TRIGGER:-PT15M',
        'END:VALARM',
        'END:VEVENT',
      ),
    );
    expect(skipped).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('With alarm');
  });

  it('skips and counts an event with no DTSTART; the rest still import (L5)', () => {
    const { events, skipped } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:g@x',
        'SUMMARY:No start',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:h@x',
        'SUMMARY:Fine',
        'DTSTART;VALUE=DATE:20260706',
        'END:VEVENT',
      ),
    );
    expect(skipped).toBe(1);
    expect(events.map((e) => e.uid)).toEqual(['h@x']);
  });

  it('never throws on garbage input', () => {
    expect(parseIcs('not an ics file at all')).toEqual({ events: [], skipped: 0 });
    expect(parseIcs('')).toEqual({ events: [], skipped: 0 });
  });
});
