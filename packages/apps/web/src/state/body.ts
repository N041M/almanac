import { create } from 'zustand';
import { addDays, type ISODate } from '@almanac/core';
import type { BodyDaySlice } from '@almanac/body';
import { quietly } from './meals-services';
import { bodyStore } from './body-services';
import { today } from '../clock';

/** How much history feeds the trend — a year of entries is plenty. */
export const BODY_HISTORY_DAYS = 365;

const EMPTY_SLICE: BodyDaySlice = { weightKg: null, bodyFatPct: null };

export interface BodyState {
  loaded: boolean;
  loading: boolean;
  /** Every logged day in the history window (absent = none, L5). */
  days: Readonly<Record<ISODate, BodyDaySlice>>;

  load: () => Promise<void>;
  /** Merge one field into the day and persist (optimistic, quiet on failure). */
  update: (date: ISODate, patch: Partial<BodyDaySlice>) => Promise<void>;
}

export const useBody = create<BodyState>((set, get) => ({
  loaded: false,
  loading: false,
  days: {},

  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const to = today();
      const logged = await bodyStore.readLoggedDays(addDays(to, -BODY_HISTORY_DAYS), to);
      const days: Record<ISODate, BodyDaySlice> = {};
      for (const [date, slice] of logged) days[date] = slice;
      set({ loaded: true, days });
    } finally {
      set({ loading: false });
    }
  },

  update: async (date, patch) => {
    const next = { ...(get().days[date] ?? EMPTY_SLICE), ...patch };
    set((s) => {
      const days = { ...s.days };
      if (next.weightKg === null && next.bodyFatPct === null) delete days[date];
      else days[date] = next;
      return { days };
    });
    await quietly(() => bodyStore.writeDay(date, next));
  },
}));
