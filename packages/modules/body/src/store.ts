import type { DayStore, ISODate, SliceCodec } from '@almanac/core';
import { getSlice } from '@almanac/core';
import { bodyDayCodec, BODY_NAMESPACE, type BodyDaySlice } from './slice.js';

/**
 * The body module's persistence: the day slice is its only state — no module
 * keys. Framework-free; the UI layer composes it.
 */
export interface BodyStore {
  /** One day's log (absent/corrupt reads as the empty slice, L5). */
  readDay(date: ISODate): Promise<BodyDaySlice>;
  writeDay(date: ISODate, slice: BodyDaySlice): Promise<void>;
  /** Every day with any entry in the range — the trend input. */
  readLoggedDays(from: ISODate, to: ISODate): Promise<Map<ISODate, BodyDaySlice>>;
}

export function createBodyStore(dayStore: DayStore): BodyStore {
  return {
    readDay: (date) => dayStore.readSlice(date, bodyDayCodec),
    writeDay: (date, slice) => dayStore.writeSlice(date, bodyDayCodec, slice),
    readLoggedDays: async (from, to) => {
      const days = await dayStore.getRange(from, to, [bodyDayCodec as SliceCodec<unknown>]);
      const out = new Map<ISODate, BodyDaySlice>();
      for (const day of days) {
        const slice = getSlice<BodyDaySlice>(day, BODY_NAMESPACE);
        if (slice === undefined) continue;
        if (slice.weightKg !== null || slice.bodyFatPct !== null) out.set(day.date, slice);
      }
      return out;
    },
  };
}
