import { describe, expect, it } from 'vitest';
import { occurrencesForRange, habitStreak } from './occurrences.js';
import type { EventItem, Habit, Task } from './types.js';

const base = { categories: [], contexts: [] };

const task: Task = {
  ...base,
  kind: 'task',
  id: 'rent',
  title: 'Pay rent',
  due: { date: '2026-07-10' },
  doneAt: null,
};

const allDayEvent: EventItem = {
  ...base,
  kind: 'event',
  id: 'party',
  title: 'Garden party',
  when: { allDay: '2026-07-11' },
};

// 2026-07-08 15:00 UTC → 2026-07-10 11:00 UTC: touches 3 days.
const trip: EventItem = {
  ...base,
  kind: 'event',
  id: 'trip',
  title: 'Prague trip',
  when: {
    span: { startUtc: Date.UTC(2026, 6, 8, 15), endUtc: Date.UTC(2026, 6, 10, 11), zone: 'UTC' },
  },
};

const standup: EventItem = {
  ...base,
  kind: 'event',
  id: 'standup',
  title: 'Standup',
  when: { allDay: '2026-07-06' },
  recurrence: { freq: 'weekly', start: '2026-07-06', byWeekday: [1, 3] }, // Mon + Wed
  overrides: [
    { seriesId: 'standup', occurrenceDate: '2026-07-08', changes: 'cancelled' },
    { seriesId: 'standup', occurrenceDate: '2026-07-13', changes: { title: 'Standup (remote)' } },
  ],
};

const gym: Habit = {
  ...base,
  kind: 'habit',
  id: 'gym',
  title: 'Gym',
  recurrence: { freq: 'weekly', start: '2026-06-01', byWeekday: [1, 4] }, // Mon + Thu
  completions: ['2026-07-02', '2026-07-06'],
};

describe('occurrencesForRange', () => {
  it('maps every kind onto its days: due tasks, all-day + spanning events, habits', () => {
    const map = occurrencesForRange([task, allDayEvent, trip, gym], '2026-07-06', '2026-07-12', 'UTC');
    expect(map.get('2026-07-10')?.map((o) => o.item.id).sort()).toEqual(['rent', 'trip']);
    expect(map.get('2026-07-11')?.map((o) => o.item.id)).toEqual(['party']);
    // the span contributes to each day it touches, with position metadata
    expect(map.get('2026-07-08')?.[0]).toMatchObject({ item: trip, spanDay: 0, spanDays: 3 });
    expect(map.get('2026-07-09')?.[0]).toMatchObject({ spanDay: 1 });
    // habit fires Mon + Thu
    expect(map.get('2026-07-06')?.some((o) => o.item.id === 'gym')).toBe(true);
    expect(map.get('2026-07-09')?.some((o) => o.item.id === 'gym')).toBe(true);
  });

  it('recurring events expand through overrides: cancelled gone, changes attached (5.1)', () => {
    const map = occurrencesForRange([standup], '2026-07-06', '2026-07-14', 'UTC');
    expect(map.get('2026-07-06')?.[0]?.changes).toBeUndefined();
    expect(map.get('2026-07-08')).toBeUndefined(); // cancelled instance
    expect(map.get('2026-07-13')?.[0]?.changes).toEqual({ title: 'Standup (remote)' });
  });

  it('a task with no due date contributes to no day — lists, not cells', () => {
    const someday: Task = { ...task, id: 'someday', doneAt: null };
    delete (someday as Partial<Task>).due;
    const map = occurrencesForRange([someday], '2026-01-01', '2026-12-31', 'UTC');
    expect(map.size).toBe(0);
  });
});

describe('habitStreak', () => {
  const scheduled = ['2026-06-29', '2026-07-02', '2026-07-06', '2026-07-09'];

  it('counts consecutive completed scheduled days up to today', () => {
    expect(habitStreak(['2026-07-02', '2026-07-06'], scheduled, '2026-07-06')).toBe(2);
  });

  it('today still open does not break the streak; an earlier miss does', () => {
    expect(habitStreak(['2026-07-02', '2026-07-06'], scheduled, '2026-07-09')).toBe(2);
    expect(habitStreak(['2026-06-29', '2026-07-06'], scheduled, '2026-07-06')).toBe(1);
  });
});
