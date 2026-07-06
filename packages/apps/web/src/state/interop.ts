import { create } from 'zustand';
import { endOfMonth, startOfMonth, type ISODate } from '@almanac/core';
import { parseIcs, serializeIcs } from '@almanac/calendar-interop';
import type { EventItem } from '@almanac/tasks';
import { useTasks } from './tasks';
import { systemClock, today } from '../clock';
import { toCalendarEvent, toEventItem } from './interop-map';

export interface InteropState {
  from: ISODate;
  to: ISODate;
  /** Last import outcome for the status line, or null before any import. */
  lastImport: { imported: number; skipped: number } | null;
  setRange: (patch: { from?: ISODate; to?: ISODate }) => void;
  /** Parse ICS text and add its events to the tasks store (never throws, L5). */
  importText: (text: string) => Promise<void>;
  /** Serialize every event visible in [from, to] to an ICS document. */
  exportText: () => string;
}

export const useInterop = create<InteropState>((set, get) => ({
  from: startOfMonth(today()),
  to: endOfMonth(today()),
  lastImport: null,

  setRange: (patch) => set(patch),

  importText: async (text) => {
    const { events, skipped } = parseIcs(text);
    const items = events.map(toEventItem);
    await useTasks.getState().importEvents(items);
    set({ lastImport: { imported: items.length, skipped } });
  },

  exportText: () => {
    const { from, to } = get();
    const tasks = useTasks.getState();
    // Occurrences resolve the range (recurring + single); keep the series, not
    // the expanded instances — one VEVENT with its RRULE.
    const inRange = new Set<string>();
    for (const list of tasks.occurrences(from, to).values()) {
      for (const occ of list) if (occ.item.kind === 'event') inRange.add(occ.item.id);
    }
    const events = tasks.items.filter(
      (item): item is EventItem => item.kind === 'event' && inRange.has(item.id),
    );
    return serializeIcs(events.map(toCalendarEvent), systemClock.now());
  },
}));
