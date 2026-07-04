// @almanac/meals — the meal-selection engine (§6), the first module bolted
// onto the calendar core. Depends on @almanac/core and @almanac/food only —
// never another module (L1). Engine logic is pure and deterministic (L4):
// all randomness via the injected Rng, all dates as ISODate values.

export * from './engine/index.js';
export type { MealsDaySlice } from './slice.js';
export { MEALS_NAMESPACE, MEALS_SLICE_VERSION, mealsDayCodec } from './slice.js';
export { mealsManifest } from './manifest.js';
export type { MealsStore } from './store.js';
export {
  createMealsStore,
  DEFAULT_SETTINGS,
  MEALS_ITEMS_VERSION,
  MEALS_SETTINGS_VERSION,
} from './store.js';
export { en as mealsMessagesEn } from './i18n/en.js';
export { cs as mealsMessagesCs } from './i18n/cs.js';

export const MEALS_MODULE_VERSION = '0.0.0';
