import type { ModuleManifest, SliceCodec } from '@almanac/core';
import { MEALS_NAMESPACE, mealsDayCodec } from './slice.js';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * What the meals module declares to the app shell (the manifest seam, defined
 * with this first module). No signals yet — the engine *consumes* context
 * signals abstractly when they exist; it provides none.
 */
export const mealsManifest: ModuleManifest = {
  id: MEALS_NAMESPACE,
  codecs: [mealsDayCodec as SliceCodec<unknown>],
  messages: { en, cs },
};
