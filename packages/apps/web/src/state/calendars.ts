import { create } from 'zustand';
import { storagePort } from './persistence';
import { useCalendar } from './store';
import { systemClock } from '../clock';

/**
 * Multiple calendars (P6, D7): a calendar is a named color + visibility
 * toggle; entries carry `calendarId`. Hiding is a **view filter, never
 * deletion** — and an entry with an unknown calendarId renders on the default
 * calendar rather than being dropped (L5 matrix).
 */
export interface UserCalendar {
  id: string;
  name: string;
  /** Hue 0–359 — rendered theme-safely like tag colors. */
  hue: number;
  visible: boolean;
}

export const DEFAULT_CALENDAR_ID = 'default';
const KEY = 'calendars:list';
const VERSION = 1;

/** The default calendar always exists — it's where unknown ids degrade to. */
function withDefault(list: UserCalendar[]): UserCalendar[] {
  return list.some((c) => c.id === DEFAULT_CALENDAR_ID)
    ? list
    : [{ id: DEFAULT_CALENDAR_ID, name: '', hue: 220, visible: true }, ...list];
}

function decode(raw: string | null): UserCalendar[] {
  if (raw === null) return withDefault([]);
  try {
    const parsed: unknown = JSON.parse(raw);
    const envelope = parsed as { v?: number; d?: unknown };
    if (envelope.v !== VERSION || !Array.isArray(envelope.d)) return withDefault([]);
    const list = envelope.d.filter(
      (c): c is UserCalendar =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as UserCalendar).id === 'string' &&
        typeof (c as UserCalendar).name === 'string' &&
        typeof (c as UserCalendar).hue === 'number',
    );
    return withDefault(list.map((c) => ({ ...c, visible: c.visible !== false })));
  } catch {
    return withDefault([]); // corrupt slice → defaults, in isolation (L5)
  }
}

interface CalendarsState {
  loaded: boolean;
  calendars: UserCalendar[];

  load: () => Promise<void>;
  add: (name: string, hue: number) => Promise<void>;
  toggleVisible: (id: string) => Promise<void>;
  /** Entries keep their calendarId; they degrade to the default calendar. */
  remove: (id: string) => Promise<void>;
  /** Resolve an entry's calendar: unknown/hidden-aware helper. */
  calendarOf: (calendarId: string | undefined) => UserCalendar;
  /** Ids whose entries are currently filtered out of every view. */
  hiddenIds: () => Set<string>;
}

export const useCalendars = create<CalendarsState>((set, get) => {
  async function persist(list: UserCalendar[]): Promise<void> {
    set({ calendars: list });
    try {
      await storagePort.write(
        KEY,
        JSON.stringify({ v: VERSION, d: list, m: systemClock.now() }),
      );
    } catch {
      // Session-only calendars still work (L5).
    }
    void useCalendar.getState().invalidateDays();
  }

  return {
    loaded: false,
    calendars: withDefault([]),

    load: async () => {
      if (get().loaded) return;
      let raw: string | null = null;
      try {
        raw = await storagePort.read(KEY);
      } catch {
        // defaults
      }
      set({ loaded: true, calendars: decode(raw) });
    },

    add: (name, hue) =>
      persist([
        ...get().calendars,
        { id: crypto.randomUUID(), name: name.trim(), hue, visible: true },
      ]),

    toggleVisible: (id) =>
      persist(get().calendars.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))),

    remove: (id) => {
      if (id === DEFAULT_CALENDAR_ID) return Promise.resolve(); // the fallback stays
      return persist(get().calendars.filter((c) => c.id !== id));
    },

    calendarOf: (calendarId) => {
      const { calendars } = get();
      return (
        calendars.find((c) => c.id === calendarId) ??
        calendars.find((c) => c.id === DEFAULT_CALENDAR_ID) ??
        { id: DEFAULT_CALENDAR_ID, name: '', hue: 220, visible: true }
      );
    },

    hiddenIds: () =>
      new Set(get().calendars.filter((c) => !c.visible).map((c) => c.id)),
  };
});

/** Is this entry visible under the current calendar filters? (L5: unknown → default's visibility.) */
export function isEntryVisible(calendarId: string | undefined): boolean {
  return useCalendars.getState().calendarOf(calendarId).visible;
}