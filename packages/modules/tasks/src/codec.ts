import { isValidISODate } from '@almanac/core';
import type { InstanceOverride, Recurrence, TimedSpan } from '@almanac/core';
import type {
  DueDate,
  EventItem,
  EventPatch,
  EventWhen,
  Habit,
  Task,
  TaskItem,
  TaskItemBase,
} from './types.js';

// Persisted-shape validation (§11): a corrupt record decodes to null and is
// skipped in isolation — one bad task never takes down the list (L5).
export const TASKS_SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function asFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Trusts the shape loosely — the engine treats malformed rules as [] anyway (L5). */
function decodeRecurrence(value: unknown): Recurrence | undefined {
  if (!isRecord(value) || typeof value['freq'] !== 'string' || typeof value['start'] !== 'string') {
    return undefined;
  }
  return value as unknown as Recurrence;
}

function decodeSpan(value: unknown): TimedSpan | undefined {
  if (!isRecord(value)) return undefined;
  const startUtc = asFinite(value['startUtc']);
  const endUtc = asFinite(value['endUtc']);
  if (startUtc === undefined || endUtc === undefined) return undefined;
  return { startUtc, endUtc, zone: typeof value['zone'] === 'string' ? value['zone'] : 'UTC' };
}

function decodeWhen(value: unknown): EventWhen | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value['allDay'] === 'string' && isValidISODate(value['allDay'])) {
    return { allDay: value['allDay'] };
  }
  const span = decodeSpan(value['span']);
  return span === undefined ? undefined : { span };
}

function decodeDue(value: unknown): DueDate | undefined {
  if (!isRecord(value) || typeof value['date'] !== 'string' || !isValidISODate(value['date'])) {
    return undefined;
  }
  const minutes = asFinite(value['minutes']);
  return {
    date: value['date'],
    ...(minutes !== undefined && minutes >= 0 && minutes < 1440 ? { minutes } : {}),
  };
}

function decodeBase(raw: Record<string, unknown>): TaskItemBase | null {
  const id = raw['id'];
  const title = raw['title'];
  if (typeof id !== 'string' || typeof title !== 'string') return null;
  const p = asFinite(raw['priority']);
  const priority = p === 1 || p === 2 || p === 3 ? p : undefined;
  return {
    id,
    title,
    categories: strings(raw['categories']),
    contexts: strings(raw['contexts']),
    ...(typeof raw['notes'] === 'string' && { notes: raw['notes'] }),
    ...(typeof raw['calendarId'] === 'string' && { calendarId: raw['calendarId'] }),
    ...(typeof raw['listId'] === 'string' && { listId: raw['listId'] }),
    ...(typeof raw['place'] === 'string' && { place: raw['place'] }),
    ...(priority !== undefined ? { priority } : {}),
    ...(raw['transparency'] === 'free' ? { transparency: 'free' as const } : {}),
    ...(raw['visibility'] === 'private' ? { visibility: 'private' as const } : {}),
  };
}

export function decodeTaskItem(raw: unknown): TaskItem | null {
  if (!isRecord(raw)) return null;
  const base = decodeBase(raw);
  if (base === null) return null;
  const recurrence = decodeRecurrence(raw['recurrence']);

  switch (raw['kind']) {
    case 'task': {
      const due = decodeDue(raw['due']);
      const doneAt = raw['doneAt'];
      const task: Task = {
        ...base,
        kind: 'task',
        doneAt: typeof doneAt === 'string' && isValidISODate(doneAt) ? doneAt : null,
        ...(due !== undefined && { due }),
        ...(recurrence !== undefined && { recurrence }),
      };
      return task;
    }
    case 'event': {
      const when = decodeWhen(raw['when']);
      if (when === undefined) return null; // an event without a when isn't one
      const overrides = Array.isArray(raw['overrides'])
        ? (raw['overrides'] as InstanceOverride<EventPatch>[])
        : undefined;
      const event: EventItem = {
        ...base,
        kind: 'event',
        when,
        ...(recurrence !== undefined && { recurrence }),
        // applyOverrides skips corrupt entries itself (L5) — pass through.
        ...(overrides !== undefined && { overrides }),
      };
      return event;
    }
    case 'habit': {
      if (recurrence === undefined) return null; // habits recur by definition
      const habit: Habit = {
        ...base,
        kind: 'habit',
        recurrence,
        completions: strings(raw['completions']).filter(isValidISODate),
      };
      return habit;
    }
    default:
      return null;
  }
}
