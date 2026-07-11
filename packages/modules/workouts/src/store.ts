import type { DayStore, ISODate, SliceCodec } from '@almanac/core';
import { getSlice } from '@almanac/core';
import { workoutsDayCodec, WORKOUTS_NAMESPACE, type WorkoutsDaySlice } from './slice.js';

/**
 * The workouts module's persistence: the day slice is its only state — no
 * module keys yet (the exercise library arrives with plan generation).
 * Framework-free; the UI layer composes it.
 */
export interface WorkoutsStore {
  /** One day's sessions (absent/corrupt reads as the empty slice, L5). */
  readDay(date: ISODate): Promise<WorkoutsDaySlice>;
  writeDay(date: ISODate, slice: WorkoutsDaySlice): Promise<void>;
  /** Every day with sessions in the range — history/insights input. */
  readLoggedDays(from: ISODate, to: ISODate): Promise<Map<ISODate, WorkoutsDaySlice>>;
}

export function createWorkoutsStore(dayStore: DayStore): WorkoutsStore {
  return {
    readDay: (date) => dayStore.readSlice(date, workoutsDayCodec),
    writeDay: (date, slice) => dayStore.writeSlice(date, workoutsDayCodec, slice),
    readLoggedDays: async (from, to) => {
      const days = await dayStore.getRange(from, to, [workoutsDayCodec as SliceCodec<unknown>]);
      const out = new Map<ISODate, WorkoutsDaySlice>();
      for (const day of days) {
        const slice = getSlice<WorkoutsDaySlice>(day, WORKOUTS_NAMESPACE);
        if (slice !== undefined && slice.sessions.length > 0) out.set(day.date, slice);
      }
      return out;
    },
  };
}
