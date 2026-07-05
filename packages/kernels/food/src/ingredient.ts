import type { NutritionFacts } from './nutrition.js';

/** A catalog food item (§7) — the unit shopping aggregates and recipes reference. */
export interface Ingredient {
  id: string;
  name: string;
  /** Aisle/category tags — shopping groups by these; empty is a normal state. */
  tags: string[];
  /** Preferred unit code (core units registry) for entering quantities. */
  defaultUnit?: string;
  /** Product barcode when the entry came from / was enriched by a lookup. */
  barcode?: string;
  /** Per-100g facts enable derived recipe nutrition; absent = manual-only entry. */
  nutrition?: NutritionFacts;
}
