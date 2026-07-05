import { normalize } from '@almanac/core';
import type { Ingredient } from './ingredient.js';
import type { Recipe } from './recipe.js';
import type { MacroSet } from './nutrition.js';

const MACRO_FIELDS = ['kcal', 'proteinG', 'carbsG', 'fatG'] as const;

export interface DerivedNutrition {
  /** Whole-recipe totals from the ingredients that could be accounted for. */
  total: MacroSet;
  perServing: MacroSet;
  /** The divisor actually used; invalid/missing servings degrade to 1. */
  servingsUsed: number;
  /** True when `recipe.servings` was unusable and 1 was assumed (§9: flag, don't throw). */
  servingsAssumed: boolean;
  /**
   * Ingredient ids whose contribution is unknown: not in the catalog, no
   * per-100g facts, or a quantity that doesn't normalize to mass (no density
   * data for volumes/counts). Partial data reduces function, never crashes (L5)
   * — callers show the partial totals and may flag these.
   */
  unaccounted: string[];
}

/**
 * Recipe nutrition derived from its ingredients' per-100g facts (§7). Purely
 * additive per field: a macro appears in the totals only if at least one
 * ingredient contributed it; sparse facts stay sparse rather than reading as 0.
 */
export function deriveRecipeNutrition(
  recipe: Recipe,
  ingredientsById: ReadonlyMap<string, Ingredient>,
): DerivedNutrition {
  const total: MacroSet = {};
  const unaccounted: string[] = [];

  for (const { ingredientId, quantity } of recipe.ingredients) {
    const facts = ingredientsById.get(ingredientId)?.nutrition?.per100g;
    const grams = normalize(quantity);
    if (facts === undefined || grams === undefined || grams.unit !== 'g') {
      unaccounted.push(ingredientId);
      continue;
    }
    let contributed = false;
    for (const field of MACRO_FIELDS) {
      const per100 = facts[field];
      if (per100 === undefined || !Number.isFinite(per100)) continue;
      total[field] = (total[field] ?? 0) + (per100 * grams.value) / 100;
      contributed = true;
    }
    if (!contributed) unaccounted.push(ingredientId);
  }

  const servingsValid = Number.isFinite(recipe.servings) && recipe.servings > 0;
  const servingsUsed = servingsValid ? recipe.servings : 1;
  const perServing: MacroSet = {};
  for (const field of MACRO_FIELDS) {
    const value = total[field];
    if (value !== undefined) perServing[field] = value / servingsUsed;
  }

  return { total, perServing, servingsUsed, servingsAssumed: !servingsValid, unaccounted };
}
