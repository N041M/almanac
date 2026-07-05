import { create } from 'zustand';
import { createPersistedList } from './persisted-list';
import { useCalendar } from './store';

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
const DEFAULT_CALENDAR: UserCalendar = {
  id: DEFAULT_CALENDAR_ID,
  name: '',
  hue: 220,
  visible: true,
};

const persisted = createPersistedList<UserCalendar>({
  key: 'calendars:list',
  version: 1,
  defaultEntity: DEFAULT_CALENDAR,
  isEntity: (value): value is UserCalendar =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UserCalendar).id === 'string' &&
    typeof (value as UserCalendar).name === 'string' &&
    typeof (value as UserCalendar).hue === 'number',
});

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
  async function persist(calendars: UserCalendar[]): Promise<void> {
    set({ calendars });
    await persisted.write(calendars);
    void useCalendar.getState().invalidateDays();
  }

  return {
    loaded: false,
    calendars: persisted.withDefault([]),

    load: async () => {
      if (get().loaded) return;
      const calendars = (await persisted.read()).map((c) => ({
        ...c,
        visible: c.visible !== false,
      }));
      set({ loaded: true, calendars });
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
        DEFAULT_CALENDAR
      );
    },

    hiddenIds: () => new Set(get().calendars.filter((c) => !c.visible).map((c) => c.id)),
  };
});

/** Is this entry visible under the current calendar filters? (L5: unknown → default's visibility.) */
export function isEntryVisible(calendarId: string | undefined): boolean {
  return useCalendars.getState().calendarOf(calendarId).visible;
}
