import { create } from 'zustand';
import type { ISODate } from '@almanac/core';
import type { SessionExercise, WorkoutsDaySlice } from '@almanac/workouts';
import { quietly } from './meals-services';
import { workoutsStore } from './workouts-services';

const EMPTY_SLICE: WorkoutsDaySlice = { sessions: [] };

export interface WorkoutsState {
  /** Read-through cache of day slices (absent day = the empty slice, L5). */
  slices: Readonly<Record<ISODate, WorkoutsDaySlice>>;

  load: (date: ISODate) => Promise<void>;
  addSession: (date: ISODate, title: string) => Promise<void>;
  removeSession: (date: ISODate, sessionId: string) => Promise<void>;
  addExercise: (date: ISODate, sessionId: string, exercise: SessionExercise) => Promise<void>;
  removeExercise: (date: ISODate, sessionId: string, index: number) => Promise<void>;
}

export const useWorkouts = create<WorkoutsState>((set, get) => {
  async function write(date: ISODate, next: WorkoutsDaySlice): Promise<void> {
    set((s) => ({ slices: { ...s.slices, [date]: next } }));
    await quietly(() => workoutsStore.writeDay(date, next));
  }

  function current(date: ISODate): WorkoutsDaySlice {
    return get().slices[date] ?? EMPTY_SLICE;
  }

  return {
    slices: {},

    load: async (date) => {
      if (date in get().slices) return;
      const slice = await workoutsStore.readDay(date);
      set((s) => ({ slices: { ...s.slices, [date]: slice } }));
    },

    addSession: async (date, title) => {
      const trimmed = title.trim();
      if (trimmed === '') return; // empty log: a quiet no-op (L5)
      const session = {
        id: crypto.randomUUID(),
        title: trimmed,
        exercises: [],
        durationMin: null,
        note: '',
      };
      await write(date, { sessions: [...current(date).sessions, session] });
    },

    removeSession: async (date, sessionId) => {
      await write(date, {
        sessions: current(date).sessions.filter((s) => s.id !== sessionId),
      });
    },

    addExercise: async (date, sessionId, exercise) => {
      if (exercise.name.trim() === '') return;
      await write(date, {
        sessions: current(date).sessions.map((s) =>
          s.id === sessionId ? { ...s, exercises: [...s.exercises, exercise] } : s,
        ),
      });
    },

    removeExercise: async (date, sessionId, index) => {
      await write(date, {
        sessions: current(date).sessions.map((s) =>
          s.id === sessionId
            ? { ...s, exercises: s.exercises.filter((_, i) => i !== index) }
            : s,
        ),
      });
    },
  };
});
