import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from './types.js';
import { serializeIcs } from './serialize-ics.js';
import { parseIcs } from './parse-ics.js';

describe('serializeIcs (P8)', () => {
  it('wraps events in a VCALENDAR and escapes TEXT', () => {
    const out = serializeIcs(
      [{ uid: 'a@x', title: 'Lunch; with, Anna', when: { allDay: '2026-07-06' } }],
      Date.UTC(2026, 0, 1),
    );
    expect(out).toContain('BEGIN:VCALENDAR');
    expect(out).toContain('SUMMARY:Lunch\\; with\\, Anna');
    expect(out).toContain('DTSTART;VALUE=DATE:20260706');
    // All-day DTEND is exclusive (the next day).
    expect(out).toContain('DTEND;VALUE=DATE:20260707');
    expect(out).toMatch(/\r\n/);
  });

  it('round-trips all-day, timed, and recurring events', () => {
    const events: CalendarEvent[] = [
      { uid: 'a@x', title: 'Birthday', when: { allDay: '2026-07-06' } },
      {
        uid: 'b@x',
        title: 'Standup',
        location: 'HQ',
        when: { span: { startUtc: Date.UTC(2026, 6, 6, 9, 0), endUtc: Date.UTC(2026, 6, 6, 9, 30), zone: 'UTC' } },
      },
      {
        uid: 'c@x',
        title: 'Gym',
        when: { allDay: '2026-07-06' },
        recurrence: { freq: 'weekly', start: '2026-07-06', interval: 2, byWeekday: [1, 3], count: 10 },
      },
    ];
    const reparsed = parseIcs(serializeIcs(events, Date.UTC(2026, 0, 1)));
    expect(reparsed.skipped).toBe(0);
    expect(reparsed.events).toEqual(events);
  });

  it('folds lines longer than 75 octets', () => {
    const long = 'x'.repeat(200);
    const out = serializeIcs([{ uid: 'a@x', title: long, when: { allDay: '2026-07-06' } }]);
    // Every physical line stays within the 75-octet limit.
    for (const line of out.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });
});
