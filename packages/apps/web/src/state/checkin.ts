import { create } from 'zustand';
import type { ISODate } from '@almanac/core';
import type { CheckinDaySlice } from '@almanac/checkin';
import { quietly } from './meals-services';
import { checkinStore } from './checkin-services';

const EMPTY_SLICE: CheckinDaySlice = { mood: null, energy: null, symptoms: [], note: '' };

export interface CheckinState {
  /** Read-through cache of day slices (absent day = the empty slice, L5). */
  slices: Readonly<Record<ISODate, CheckinDaySlice>>;

  load: (date: ISODate) => Promise<void>;
  /** Merge a partial log into the day and persist (optimistic, quiet on failure). */
  update: (date: ISODate, patch: Partial<CheckinDaySlice>) => Promise<void>;
  addSymptom: (date: ISODate, symptom: string) => Promise<void>;
  removeSymptom: (date: ISODate, symptom: string) => Promise<void>;
}

export const useCheckin = create<CheckinState>((set, get) => {
  async function write(date: ISODate, next: CheckinDaySlice): Promise<void> {
    set((s) => ({ slices: { ...s.slices, [date]: next } }));
    await quietly(() => checkinStore.writeDay(date, next));
  }

  return {
    slices: {},

    load: async (date) => {
      if (date in get().slices) return;
      const slice = await checkinStore.readDay(date);
      set((s) => ({ slices: { ...s.slices, [date]: slice } }));
    },

    update: async (date, patch) => {
      await write(date, { ...(get().slices[date] ?? EMPTY_SLICE), ...patch });
    },

    addSymptom: async (date, symptom) => {
      const trimmed = symptom.trim();
      const current = get().slices[date] ?? EMPTY_SLICE;
      // Empty or duplicate input: a quiet no-op (L5).
      if (trimmed === '' || current.symptoms.includes(trimmed)) return;
      await write(date, { ...current, symptoms: [...current.symptoms, trimmed] });
    },

    removeSymptom: async (date, symptom) => {
      const current = get().slices[date] ?? EMPTY_SLICE;
      await write(date, { ...current, symptoms: current.symptoms.filter((s) => s !== symptom) });
    },
  };
});
