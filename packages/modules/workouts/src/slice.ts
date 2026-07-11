import type { SliceCodec } from '@almanac/core';

/**
 * The workouts module's contribution to a Day (§8): the day's logged training
 * sessions. A session is a title plus optional per-exercise set lines — a log
 * of what happened, not advice about what should. Plan *generation* (the
 * meal-engine pattern over an exercise library) is a later, optional layer
 * that will write the same shape (§8: adjustable scaffolds, never medical/PT
 * advice). No sessions is the ordinary state (L5).
 */
export interface SessionExercise {
  name: string;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
}

export interface WorkoutSession {
  id: string;
  title: string;
  exercises: SessionExercise[];
  durationMin: number | null;
  note: string;
}

export interface WorkoutsDaySlice {
  sessions: WorkoutSession[];
}

export const WORKOUTS_NAMESPACE = 'workouts';
export const WORKOUTS_SLICE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A finite positive number, else null — bad counts read as "not recorded" (L5). */
function positiveOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** One exercise line, or null when the shape is unusable (dropped, L5). */
function decodeExercise(value: unknown): SessionExercise | null {
  if (!isRecord(value) || typeof value['name'] !== 'string' || value['name'].trim() === '') {
    return null;
  }
  return {
    name: value['name'],
    sets: positiveOrNull(value['sets']),
    reps: positiveOrNull(value['reps']),
    weightKg: positiveOrNull(value['weightKg']),
  };
}

/** One session, or null when unusable — a bad session costs only itself (L5). */
function decodeSession(value: unknown): WorkoutSession | null {
  if (!isRecord(value) || typeof value['id'] !== 'string') return null;
  const exercises = Array.isArray(value['exercises'])
    ? value['exercises']
        .map(decodeExercise)
        .filter((exercise): exercise is SessionExercise => exercise !== null)
    : [];
  return {
    id: value['id'],
    title: typeof value['title'] === 'string' ? value['title'] : '',
    exercises,
    durationMin: positiveOrNull(value['durationMin']),
    note: typeof value['note'] === 'string' ? value['note'] : '',
  };
}

export const workoutsDayCodec: SliceCodec<WorkoutsDaySlice> = {
  namespace: WORKOUTS_NAMESPACE,
  version: WORKOUTS_SLICE_VERSION,
  default: () => ({ sessions: [] }),
  decode: (raw) => {
    if (!isRecord(raw)) throw new Error('workouts slice: not an object');
    const sessions = Array.isArray(raw['sessions'])
      ? raw['sessions']
          .map(decodeSession)
          .filter((session): session is WorkoutSession => session !== null)
      : [];
    return { sessions };
  },
  encode: (value) => value,
};
