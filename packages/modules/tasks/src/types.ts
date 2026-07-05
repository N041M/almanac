import type {
  ISODate,
  InstanceOverride,
  Priority,
  Recurrence,
  TimedSpan,
} from '@almanac/core';

/**
 * The three primitives (design §8) — distinct kinds that must not blur:
 * a task is discrete/done-once, an event is time-blocked, a habit recurs and
 * is tracked over time. The base carries the shape-final fields pinned at P6
 * entry (D7) — cheap now, a migration later.
 */
export interface TaskItemBase {
  id: string;
  title: string;
  notes?: string;
  /** Multiple calendars (D7): color/visibility live on the calendar, not here. */
  calendarId?: string;
  /** Which to-do list holds this item; absent = the default list (Inbox). */
  listId?: string;
  /** User-defined `#categories` — visibility-toggleable module state. */
  categories: string[];
  /** The `@home/@work/@store` axis (§8) — context, not a physical place. */
  contexts: string[];
  /** Physical location (D7; maps later). */
  place?: string;
  /** 1–3, rendered through the core intensity scale (§5); absent = full. */
  priority?: Priority;
  /** Free-busy input for P12 (D7). Absent reads as 'busy'. */
  transparency?: 'busy' | 'free';
  /** P12 sharing: show as busy-only (D7). Absent = default visibility. */
  visibility?: 'private';
}

/**
 * A task's due time is deliberately **floating wall-clock** (D7): "09:00"
 * means 09:00 in whatever zone the user wakes up in — unlike events, whose
 * instants are absolute.
 */
export interface DueDate {
  date: ISODate;
  /** Minutes into the day (0–1439); absent = date-only. */
  minutes?: number;
}

export interface Task extends TaskItemBase {
  kind: 'task';
  due?: DueDate;
  /** Completion date; null = open. */
  doneAt: ISODate | null;
  /** Optional recurrence ("water plants every Saturday"). */
  recurrence?: Recurrence;
}

/** An event's when: all-day stays a pure date; timed uses the 5.2 contract. */
export type EventWhen = { allDay: ISODate } | { span: TimedSpan };

export interface EventItem extends TaskItemBase {
  kind: 'event';
  when: EventWhen;
  recurrence?: Recurrence;
  /** Per-instance edits (5.1): stored with the series, applied on expansion. */
  overrides?: InstanceOverride<EventPatch>[];
}

/** What a single occurrence may change — the override payload (5.1). */
export interface EventPatch {
  title?: string;
  notes?: string;
  place?: string;
  when?: EventWhen;
}

export interface Habit extends TaskItemBase {
  kind: 'habit';
  /** Habits are recurring by definition. */
  recurrence: Recurrence;
  /** Days the habit was checked off — streaks derive from these. */
  completions: ISODate[];
}

export type TaskItem = Task | EventItem | Habit;
