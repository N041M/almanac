/**
 * One set of macro values. Every field is optional — crowd-sourced (OFF) and
 * manual data may miss any field, and readers treat absence as a normal state
 * (L5). Room for micronutrients later without a shape change.
 */
export interface MacroSet {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

/** Per-100g and per-serving views of the same food (§7). */
export interface NutritionFacts {
  per100g?: MacroSet;
  perServing?: MacroSet;
}
