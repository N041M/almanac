import type { DayStore, ISODate } from '@almanac/core';
import { checkinDayCodec, type CheckinDaySlice } from './slice.js';

/**
 * The check-in module's persistence: the day slice is its only state — no
 * module keys. Framework-free; the UI layer composes it.
 */
export interface CheckinStore {
  /** One day's log (absent/corrupt reads as the empty slice, L5). */
  readDay(date: ISODate): Promise<CheckinDaySlice>;
  writeDay(date: ISODate, slice: CheckinDaySlice): Promise<void>;
}

export function createCheckinStore(dayStore: DayStore): CheckinStore {
  return {
    readDay: (date) => dayStore.readSlice(date, checkinDayCodec),
    writeDay: (date, slice) => dayStore.writeSlice(date, checkinDayCodec, slice),
  };
}
