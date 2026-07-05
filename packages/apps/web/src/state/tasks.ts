import { create } from 'zustand';
import type { ISODate } from '@almanac/core';
import {
  createTasksStore,
  occurrencesForRange,
  parseQuickEntry,
  type DayOccurrence,
  type Task,
  type TaskItem,
} from '@almanac/tasks';
import { notificationPort } from '../notifications/create-notification-port';
import { isEntryVisible } from './calendars';
import { useSettings } from './settings';
import { storagePort } from './persistence';
import { useCalendar } from './store';
import { useUndo } from './undo';
import { systemClock, today } from '../clock';

// Composition root for the tasks module (L1: the app wires it, modules never
// see each other). Entity records, D6 tombstones underneath.
const tasksStore = createTasksStore(storagePort, systemClock);

// The app layer is the sanctioned edge for the viewer's zone (L4) — timed
// spans resolve their display days against it (5.2 fallback chain).
const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Local wall-clock date+minutes → absolute UTC ms (the app is the L4 edge). */
export function wallClockToUtc(date: ISODate, minutes: number): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, Math.floor(minutes / 60), minutes % 60).getTime();
}

/** What the composer's pickers contribute on top of the typed text. */
export interface QuickAddOverrides {
  date?: ISODate;
  minutes?: number;
  priority?: 1 | 2 | 3;
  /** Merged with parsed sigils; `@word` entries become contexts. */
  tags?: string[];
  notes?: string;
  calendarId?: string;
  /** Which to-do list the entry files into; absent = Inbox. */
  listId?: string;
  /** 'event' turns the entry into a calendar event (all-day, or timed when a time is set). */
  kind?: 'task' | 'event';
}

interface TasksState {
  loaded: boolean;
  loading: boolean;
  items: TaskItem[];

  load: () => Promise<void>;
  /**
   * §8 quick entry: sigils + NL date/time in the text, plus explicit picker
   * values — pickers win over parsed text (an explicit choice beats a guess).
   * Never blocked by the parser (L5); every field optional.
   */
  quickAdd: (text: string, picked?: QuickAddOverrides) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  /** Move an item to another to-do list (Inbox = clear the field). */
  moveToList: (id: string, listId: string) => Promise<void>;
  /** Everything in the window, keyed by date — for grids/agenda/day detail. */
  occurrences: (start: ISODate, end: ISODate) => Map<ISODate, DayOccurrence[]>;
}

/** Persist quietly: a failed write degrades to session-only state (L5). */
async function quietly(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch {
    // In-memory state already reflects the action.
  }
}

/**
 * Reminders (P6, uses 5.3): every open task with a due date+time gets a
 * notification at due − offset. Timers only live while the app is open, so a
 * full resync runs on load and after every change; disabled/denied ⇒ cancel
 * everything, quietly — in-app due indicators remain (L5).
 */
export function syncReminders(items: ReadonlyArray<TaskItem>): void {
  const { remindersEnabled, reminderOffsetMin } = useSettings.getState();
  for (const item of items) {
    if (item.kind !== 'task' || item.due?.minutes === undefined || item.doneAt !== null) {
      void notificationPort.cancel(item.id);
      continue;
    }
    const at = wallClockToUtc(item.due.date, item.due.minutes) - reminderOffsetMin * 60_000;
    if (!remindersEnabled || at <= systemClock.now()) {
      void notificationPort.cancel(item.id);
    } else {
      void notificationPort.schedule(item.id, at, { title: item.title });
    }
  }
}

export const useTasks = create<TasksState>((set, get) => {
  function replace(items: TaskItem[]): void {
    set({ items });
    syncReminders(items);
    void useCalendar.getState().invalidateDays();
  }

  return {
    loaded: false,
    loading: false,
    items: [],

    load: async () => {
      if (get().loaded || get().loading) return;
      set({ loading: true });
      try {
        const items = await tasksStore.list();
        set({ loaded: true, items });
        syncReminders(items);
      } finally {
        // A failed load must not brick the tab behind a stuck guard (L5).
        set({ loading: false });
      }
    },

    quickAdd: async (text, picked = {}) => {
      const trimmed = text.trim();
      if (trimmed === '') return;
      const parsed = parseQuickEntry(trimmed, today());
      // Explicit picks win over parsed guesses; both are optional (L5).
      const pickedTags = (picked.tags ?? []).map((tag) => tag.trim()).filter((t) => t !== '');
      const categories = [
        ...new Set([
          ...parsed.categories,
          ...pickedTags.filter((t) => !t.startsWith('@')).map((t) => t.toLowerCase()),
        ]),
      ];
      const contexts = [
        ...new Set([
          ...parsed.contexts,
          ...pickedTags.filter((t) => t.startsWith('@')).map((t) => t.slice(1).toLowerCase()),
        ]),
      ];
      const priority = picked.priority ?? parsed.priority;
      const date = picked.date ?? parsed.date;
      const minutes = picked.minutes ?? parsed.minutes;
      const notes = picked.notes?.trim();
      const base = {
        id: crypto.randomUUID(),
        // All tokens consumed (e.g. just "tomorrow")? The raw text is the title.
        title: parsed.title !== '' ? parsed.title : trimmed,
        categories,
        contexts,
        ...(picked.calendarId !== undefined && { calendarId: picked.calendarId }),
        ...(picked.listId !== undefined && { listId: picked.listId }),
        ...(notes !== undefined && notes !== '' && { notes }),
        ...(priority !== undefined && { priority }),
      };
      let task: TaskItem;
      if (picked.kind === 'event') {
        // An event needs a when; no date anywhere degrades to all-day today.
        const eventDate = date ?? today();
        task = {
          ...base,
          kind: 'event',
          when:
            minutes === undefined
              ? { allDay: eventDate }
              : (() => {
                  // Timed: one hour from the given wall-clock time, as an
                  // absolute instant in the viewer's zone (5.2 contract).
                  const startUtc = wallClockToUtc(eventDate, minutes);
                  return { span: { startUtc, endUtc: startUtc + 3_600_000, zone: viewerZone } };
                })(),
        };
      } else {
        task = {
          ...base,
          kind: 'task',
          doneAt: null,
          ...(date !== undefined && {
            due: { date, ...(minutes !== undefined && { minutes }) },
          }),
        };
      }
      replace([...get().items, task]);
      await quietly(() => tasksStore.save(task));
      useUndo.getState().push({
        labelKey: 'tasks:quickAddUndo',
        apply: async () => {
          replace(get().items.filter((item) => item.id !== task.id));
          await quietly(() => tasksStore.remove(task.id));
        },
      });
    },

    toggleDone: async (id) => {
      const item = get().items.find((i) => i.id === id);
      if (item === undefined || item.kind !== 'task') return;
      const next: Task = { ...item, doneAt: item.doneAt === null ? today() : null };
      replace(get().items.map((i) => (i.id === id ? next : i)));
      await quietly(() => tasksStore.save(next));
      useUndo.getState().push({
        labelKey: item.doneAt === null ? 'tasks:done' : 'tasks:reopen',
        apply: async () => {
          replace(get().items.map((i) => (i.id === id ? item : i)));
          await quietly(() => tasksStore.save(item));
        },
      });
    },

    moveToList: async (id, listId) => {
      const item = get().items.find((i) => i.id === id);
      if (item === undefined) return;
      const next = { ...item };
      if (listId === '' || listId === 'inbox') delete next.listId;
      else next.listId = listId;
      replace(get().items.map((i) => (i.id === id ? next : i)));
      await quietly(() => tasksStore.save(next));
      useUndo.getState().push({
        labelKey: 'tasks:movedList',
        apply: async () => {
          replace(get().items.map((i) => (i.id === id ? item : i)));
          await quietly(() => tasksStore.save(item));
        },
      });
    },

    removeItem: async (id) => {
      const item = get().items.find((i) => i.id === id);
      if (item === undefined) return;
      replace(get().items.filter((i) => i.id !== id));
      await quietly(() => tasksStore.remove(id)); // D6 tombstone
      useUndo.getState().push({
        labelKey: 'tasks:removeUndo',
        apply: async () => {
          replace([...get().items, item]);
          await quietly(() => tasksStore.save(item)); // revive = an edit
        },
      });
    },

    occurrences: (start, end) =>
      // Hidden calendars are a view filter, never deletion (L5).
      occurrencesForRange(
        get().items.filter((item) => isEntryVisible(item.calendarId)),
        start,
        end,
        viewerZone,
      ),
  };
});
