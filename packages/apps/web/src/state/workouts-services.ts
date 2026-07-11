import { createWorkoutsStore } from '@almanac/workouts';
import { dayStore } from './persistence';

// Composition root for the workouts module. The session log is its only
// state; the exercise library + plan generation (the meal-engine pattern)
// arrive as a later, optional layer writing the same slice (§8).
export const workoutsStore = createWorkoutsStore(dayStore);
