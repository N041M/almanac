import { create } from 'zustand';
import type { Weekday } from '@almanac/core';
import { CS_CZ, EN_US } from '@almanac/core';
import { notificationPort } from '../notifications/create-notification-port';
import { storagePort } from './persistence';
import { useCalendar } from './store';
import { DEFAULT_CALENDAR_ID } from './calendars';
import { systemClock } from '../clock';

export type TimeFormat = '12h' | '24h' | null; // null = the locale decides

const SETTINGS_KEY = 'app:settings';
const SETTINGS_VERSION = 1;

interface PersistedSettings {
  weekStartsOn?: Weekday;
  timeFormat?: '12h' | '24h';
  language?: string;
  remindersEnabled?: boolean;
  reminderOffsetMin?: number;
  /** Which calendar new entries land on (absent = the built-in default). */
  defaultCalendarId?: string;
  /** Modules the user hid (absent = all visible). */
  hiddenModules?: string[];
  /** IANA id for the hour grid's second zone column (absent = no column). */
  secondaryZone?: string;
  /** Working hours [start, end) for the hour grid's shading (absent = none). */
  workStartHour?: number;
  workEndHour?: number;
}

interface SettingsState {
  loaded: boolean;
  /** null = follow the locale (L5: unset means today's behaviour). */
  weekStartsOn: Weekday | null;
  timeFormat: TimeFormat;
  /** Off by default; enabling asks the platform once — denied stays off, quietly. */
  remindersEnabled: boolean;
  /** Minutes before the due time (P6: default offsets in settings). */
  reminderOffsetMin: number;
  /** Which calendar new entries default to (Apple: "New events default to…"). */
  defaultCalendarId: string;
  /**
   * Modules the user hid — a view filter over tabs and calendar contributions,
   * never deletion: the data keeps flowing underneath (L5).
   */
  hiddenModules: string[];
  /**
   * 5.4 leftovers, both additive: unset ⇒ today's rendering; an invalid zone
   * renders no column — the grid never breaks on a typo (L5).
   */
  secondaryZone: string | null;
  workStartHour: number | null;
  workEndHour: number | null;

  load: () => Promise<void>;
  setWeekStartsOn: (weekday: Weekday | null) => Promise<void>;
  setTimeFormat: (format: TimeFormat) => Promise<void>;
  setDefaultCalendar: (id: string) => Promise<void>;
  setModuleHidden: (id: string, hidden: boolean) => Promise<void>;
  setSecondaryZone: (zone: string | null) => Promise<void>;
  setWorkingHours: (start: number | null, end: number | null) => Promise<void>;
  /** Returns the resulting enabled state (permission may say no, quietly). */
  setRemindersEnabled: (enabled: boolean) => Promise<boolean>;
  setReminderOffsetMin: (minutes: number) => Promise<void>;
  /** Persist the language choice so a restart keeps it (the header sets locale). */
  rememberLanguage: (language: string) => Promise<void>;
  /** Vault (5.5): the whole on-device store as one JSON document. */
  exportVault: () => Promise<string>;
  /** Restores entries; returns counts. A corrupt file imports nothing (L5). */
  importVault: (json: string) => Promise<{ imported: number; skipped: number } | null>;
}

function decode(raw: string | null): PersistedSettings {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const envelope = parsed as { v?: number; d?: unknown };
    if (envelope.v !== SETTINGS_VERSION || typeof envelope.d !== 'object' || envelope.d === null) {
      return {};
    }
    const d = envelope.d as Record<string, unknown>;
    const out: PersistedSettings = {};
    if (typeof d['weekStartsOn'] === 'number' && d['weekStartsOn'] >= 0 && d['weekStartsOn'] <= 6) {
      out.weekStartsOn = d['weekStartsOn'] as Weekday;
    }
    if (d['timeFormat'] === '12h' || d['timeFormat'] === '24h') out.timeFormat = d['timeFormat'];
    if (typeof d['language'] === 'string') out.language = d['language'];
    if (d['remindersEnabled'] === true) out.remindersEnabled = true;
    if (typeof d['reminderOffsetMin'] === 'number' && d['reminderOffsetMin'] >= 0) {
      out.reminderOffsetMin = d['reminderOffsetMin'];
    }
    if (typeof d['defaultCalendarId'] === 'string') out.defaultCalendarId = d['defaultCalendarId'];
    if (Array.isArray(d['hiddenModules'])) {
      // A malformed entry costs only itself (L5).
      out.hiddenModules = d['hiddenModules'].filter((id): id is string => typeof id === 'string');
    }
    if (typeof d['secondaryZone'] === 'string' && d['secondaryZone'] !== '') {
      out.secondaryZone = d['secondaryZone'];
    }
    const hour = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 24 ? v : undefined;
    const start = hour(d['workStartHour']);
    const end = hour(d['workEndHour']);
    if (start !== undefined) out.workStartHour = start;
    if (end !== undefined) out.workEndHour = end;
    return out;
  } catch {
    return {}; // corrupt settings slice → defaults, the app never blocks (L5)
  }
}

export const useSettings = create<SettingsState>((set, get) => {
  async function persist(mutate: (d: PersistedSettings) => void): Promise<void> {
    try {
      const d = decode(await storagePort.read(SETTINGS_KEY));
      mutate(d);
      await storagePort.write(
        SETTINGS_KEY,
        JSON.stringify({ v: SETTINGS_VERSION, d, m: systemClock.now() }),
      );
    } catch {
      // Session-only settings are still settings (L5).
    }
  }

  return {
    loaded: false,
    weekStartsOn: null,
    timeFormat: null,
    remindersEnabled: false,
    reminderOffsetMin: 10,
    defaultCalendarId: DEFAULT_CALENDAR_ID,
    hiddenModules: [],
    secondaryZone: null,
    workStartHour: null,
    workEndHour: null,

    load: async () => {
      if (get().loaded) return;
      let stored: PersistedSettings = {};
      try {
        stored = decode(await storagePort.read(SETTINGS_KEY));
      } catch {
        // defaults
      }
      set({
        loaded: true,
        weekStartsOn: stored.weekStartsOn ?? null,
        timeFormat: stored.timeFormat ?? null,
        remindersEnabled: stored.remindersEnabled ?? false,
        reminderOffsetMin: stored.reminderOffsetMin ?? 10,
        defaultCalendarId: stored.defaultCalendarId ?? DEFAULT_CALENDAR_ID,
        hiddenModules: stored.hiddenModules ?? [],
        secondaryZone: stored.secondaryZone ?? null,
        workStartHour: stored.workStartHour ?? null,
        workEndHour: stored.workEndHour ?? null,
      });
      // Restore the language choice (the locale carries formatting too).
      if (stored.language === 'cs' || stored.language === 'en') {
        useCalendar.getState().setLocale(stored.language === 'cs' ? CS_CZ : EN_US);
      }
    },

    setWeekStartsOn: async (weekday) => {
      set({ weekStartsOn: weekday });
      await persist((d) => {
        if (weekday === null) delete d.weekStartsOn;
        else d.weekStartsOn = weekday;
      });
    },

    setTimeFormat: async (format) => {
      set({ timeFormat: format });
      await persist((d) => {
        if (format === null) delete d.timeFormat;
        else d.timeFormat = format;
      });
    },

    setDefaultCalendar: async (id) => {
      set({ defaultCalendarId: id });
      await persist((d) => {
        if (id === DEFAULT_CALENDAR_ID) delete d.defaultCalendarId;
        else d.defaultCalendarId = id;
      });
    },

    setModuleHidden: async (id, hidden) => {
      const current = get().hiddenModules;
      const next = hidden ? [...new Set([...current, id])] : current.filter((m) => m !== id);
      set({ hiddenModules: next });
      await persist((d) => {
        if (next.length === 0) delete d.hiddenModules;
        else d.hiddenModules = next;
      });
    },

    setSecondaryZone: async (zone) => {
      const next = zone?.trim() === '' ? null : zone;
      set({ secondaryZone: next });
      await persist((d) => {
        if (next === null) delete d.secondaryZone;
        else d.secondaryZone = next;
      });
    },

    setWorkingHours: async (start, end) => {
      set({ workStartHour: start, workEndHour: end });
      await persist((d) => {
        if (start === null) delete d.workStartHour;
        else d.workStartHour = start;
        if (end === null) delete d.workEndHour;
        else d.workEndHour = end;
      });
    },

    rememberLanguage: (language) =>
      persist((d) => {
        d.language = language;
      }),

    setRemindersEnabled: async (enabled) => {
      // Enabling needs the platform's blessing; denial stays off — asked
      // once, never nagging (5.3 L5 row).
      const granted = enabled ? await notificationPort.requestPermission() : false;
      const next = enabled && granted;
      set({ remindersEnabled: next });
      await persist((d) => {
        if (next) d.remindersEnabled = true;
        else delete d.remindersEnabled;
      });
      return next;
    },

    setReminderOffsetMin: async (minutes) => {
      set({ reminderOffsetMin: minutes });
      await persist((d) => {
        d.reminderOffsetMin = minutes;
      });
    },

    exportVault: async () => {
      const keys = await storagePort.keys();
      const values =
        storagePort.readMany !== undefined
          ? await storagePort.readMany(keys)
          : await Promise.all(keys.map((key) => storagePort.read(key)));
      const entries: Record<string, string> = {};
      keys.forEach((key, i) => {
        const value = values[i];
        if (typeof value === 'string') entries[key] = value;
      });
      return JSON.stringify({ app: 'almanac-vault', v: 1, entries }, null, 2);
    },

    importVault: async (json) => {
      let entries: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(json);
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          (parsed as { app?: unknown }).app !== 'almanac-vault' ||
          typeof (parsed as { entries?: unknown }).entries !== 'object' ||
          (parsed as { entries?: unknown }).entries === null
        ) {
          return null;
        }
        entries = (parsed as { entries: Record<string, unknown> }).entries;
      } catch {
        return null; // unreadable file: reported, nothing touched (L5)
      }

      let imported = 0;
      let skipped = 0;
      for (const [key, value] of Object.entries(entries)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          skipped += 1;
          continue;
        }
        try {
          await storagePort.write(key, value);
          imported += 1;
        } catch {
          skipped += 1; // one bad write never aborts the file (L5)
        }
      }
      // Everything on screen may be stale now.
      await useCalendar.getState().invalidateDays();
      return { imported, skipped };
    },
  };
});
