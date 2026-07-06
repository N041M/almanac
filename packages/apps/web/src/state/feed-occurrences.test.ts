import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@almanac/calendar-interop';
import type { ISODate } from '@almanac/core';
import { feedOccurrences } from './feed-occurrences';

const start = '2026-07-01' as ISODate;
const end = '2026-07-31' as ISODate;

describe('feedOccurrences (P8 subscriptions overlay)', () => {
  it('places an all-day event on its date', () => {
    const events: CalendarEvent[] = [{ uid: 'a', title: 'Holiday', when: { allDay: '2026-07-06' } }];
    const map = feedOccurrences(events, start, end, 'UTC');
    expect(map.get('2026-07-06' as ISODate)).toEqual(['Holiday']);
  });

  it('expands a recurring event across the range', () => {
    const events: CalendarEvent[] = [
      {
        uid: 'b',
        title: 'Bin day',
        when: { allDay: '2026-07-02' },
        recurrence: { freq: 'weekly', start: '2026-07-02', byWeekday: [4] },
      },
    ];
    const map = feedOccurrences(events, start, end, 'UTC');
    expect([...map.keys()].sort()).toEqual(['2026-07-02', '2026-07-09', '2026-07-16', '2026-07-23', '2026-07-30']);
  });

  it('drops occurrences outside the range and never throws on empty input', () => {
    const events: CalendarEvent[] = [{ uid: 'c', title: 'Old', when: { allDay: '2020-01-01' } }];
    expect(feedOccurrences(events, start, end, 'UTC').size).toBe(0);
    expect(feedOccurrences([], start, end, 'UTC').size).toBe(0);
  });
});
