import { create } from 'zustand';
import type { Birthday } from '@almanac/birthdays';
import { isValidCalendarDay } from '@almanac/birthdays';
import { quietly } from './meals-services';
import { birthdaysStore } from './birthdays-services';

export interface BirthdaysState {
  loaded: boolean;
  entries: ReadonlyArray<Birthday>;

  load: () => Promise<void>;
  add: (name: string, month: number, day: number, year: number | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBirthdays = create<BirthdaysState>((set, get) => ({
  loaded: false,
  entries: [],

  load: async () => {
    if (get().loaded) return;
    const entries = await birthdaysStore.getEntries();
    set({ loaded: true, entries });
  },

  add: async (name, month, day, year) => {
    const trimmed = name.trim();
    // An impossible date or empty name is a quiet no-op (L5).
    if (trimmed === '' || !isValidCalendarDay(month, day)) return;
    const entry: Birthday = { id: crypto.randomUUID(), name: trimmed, month, day, year };
    const entries = [...get().entries, entry];
    set({ entries });
    await quietly(() => birthdaysStore.saveEntries(entries));
  },

  remove: async (id) => {
    const entries = get().entries.filter((entry) => entry.id !== id);
    set({ entries });
    await quietly(() => birthdaysStore.saveEntries(entries));
  },
}));
