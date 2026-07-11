import type { ModuleManifest, SliceCodec } from '@almanac/core';
import { WORKOUTS_NAMESPACE, workoutsDayCodec } from './slice.js';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The workouts module's manifest: its day-slice codec (the session log the
 * day record carries) and its i18n namespace (§8).
 */
export const workoutsManifest: ModuleManifest = {
  id: WORKOUTS_NAMESPACE,
  codecs: [workoutsDayCodec as SliceCodec<unknown>],
  messages: { en, cs },
};
